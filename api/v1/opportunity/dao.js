const pgdao = require('postgres-gen-dao');

var dao = {};
dao.query = {};

dao.query.internshipListQuery = `
  select 
    task.id, 
    "cycle".name as "Cycle", 
    task.title as "Title", 
    task.interns as "NumberOfPositions",
    coalesce(task.city_name || ', ' || country.value, 'Virtual') as "Location",
    (select count(*) from application_task where application_task."task_id" = task.id) as "ApplicantCount",
    (select count(*) from task_list_application 
      inner join task_list on task_list_application.task_list_id = task_list.task_list_id
      where task_list."task_id" = task.id) as "TaskListApplicantCount",
    (select count(*) from task_list where task_list.task_id = task.id) as "ListCount",
    (
      select json_agg(item)
      from (
        select updated_at, midas_user.given_name || ' ' || midas_user.last_name as fullname
        from task_list
          inner join midas_user on task_list.updated_by = midas_user.id
        where task_id = task.id
        order by updated_at desc
        limit 1
      ) item
    ) as "last_updated"
  from 
    task 
    inner join "cycle" on task."cycle_id" = "cycle"."cycle_id"
    inner join community on task.community_id = community.community_id
    inner join task_share on task.id = task_share."task_id"
    left outer join country on task."country_id" = country."country_id"
  where
    task_share.user_id = ?
    and "cycle".apply_end_date < current_date
`;

dao.query.internshipSummaryQuery = `
  select 
    task.id,
    community.community_name,
    "cycle".name as "cycleName", 
    task.title as "taskTitle", 
    bureau.name as "bureauName",
    office.name as "officeName",
    task.interns as "numberOfSeats",
    (
      select json_agg(item)
      from (
        select updated_at, midas_user.given_name || ' ' || midas_user.last_name as fullname
        from task_list
          inner join midas_user on task_list.updated_by = midas_user.id
        where task_id = task.id
        order by updated_at desc
        limit 1
      ) item
    ) as "last_updated"
  from task 
    inner join "cycle" on task."cycle_id" = "cycle"."cycle_id"
    inner join community on task.community_id = community.community_id
    left join bureau on bureau.bureau_id = task.bureau_id
    left join office on office.office_id = task.office_id
  where task.id = ?
`;

dao.query.taskShareQuery = `
  select
    left(given_name, 1) || left(last_name, 1) as initials,
    given_name,
    last_name,
    government_uri,
    user_id,
    shared_by_user_id,
    last_modified
  from 
    task_share
    inner join midas_user on task_share.user_id = midas_user."id"
  where 
    task_id = ?
    and user_id = coalesce(?, user_id)
`;

dao.query.taskListQuery = `
  select
    task_list_id,
    task_id,
    title,
    sort_order
  from
    task_list
  where task_id = ?
  order by sort_order
`;

dao.query.taskListAndOwner = `
  select
    task_list_id,
    task_list.task_id,
    task_list.title,
    sort_order,
    created_at,
    updated_at,
    updated_by
  from
    task_list
    inner join task on task_list.task_id = task.id
    inner join task_share on task.id = task_share.task_id
  where
    task_list_id = ?
    and task_share.user_id = ?
`;

dao.query.taskListApplicationAndOwner = `
  select
    tla.task_list_application_id,
    tla.task_list_id,
    tla.application_id,
    tla.sort_order,
    tla.date_last_viewed,
    tla.date_last_contacted,
    tla.created_at,
    tla.updated_at,
    tla.updated_by
  from
    task_list_application tla
    inner join task_list tl on tla.task_list_id = tl.task_list_id
    inner join task on tl.task_id = task.id
    inner join task_share on task.id = task_share.task_id
  where
    task_list_application_id = ?
    and task_share.user_id = ?
`;

dao.query.applicationsNotInListQuery = `
  select application_id
  from application_task
  where task_id = ?
  except
  select application_id
  from 
    task_list_application 
    inner join task_list on task_list_application.task_list_id = task_list.task_list_id
  where task_id = ?
`;

dao.query.taskListApplicationQuery = `
  select
    task_list_application_id,
    task_list_application.task_list_id,
    task_list_application.application_id,
    task_list_application.sort_order,
    task_list_application.date_last_contacted,
    midas_user.given_name,
    midas_user.last_name,
    midas_user.username as email,
    (
      select application_task.sort_order as choice
      from
        application_task
      where
        application_task.application_id = application.application_id
        and application_task.task_id = task_list.task_id
    ),
    (
      select json_build_object(
        'degree_level', educationcode.value,
        'major', education.major
      ) as education
      from 
        education
        inner join lookup_code as educationcode on education.degree_level_id = educationcode.lookup_code_id
      where application.application_id = education.application_id
      order by education.major
      limit 1
    ),
    application.cumulative_gpa as gpa,
    (
      select json_agg(item)
      from (
      select "language".value
      from "language"    
        inner join application_language_skill on "language".language_id = application_language_skill.language_id
      where "language".language_id = application_language_skill.language_id and application_language_skill.application_id = application.application_id
      limit 3
      ) item
    ) as languages
  from
    task_list_application
    inner join task_list on task_list_application.task_list_id = task_list.task_list_id
    inner join application on task_list_application.application_id = application.application_id
    inner join midas_user on application.user_id = midas_user.id
  where
    task_list.task_list_id = ?
  order by sort_order
`;

dao.query.communityByTaskAndEmail = `
  select midas_user.id
  from
	  community
    inner join community_user on community.community_id = community_user.community_id
    inner join task on community.community_id = task.community_id
    inner join midas_user on community_user.user_id = midas_user.id
  where
    task.id = ?
    and lower(midas_user.government_uri) = lower(?)
`;

module.exports = function (db) {
  dao.Task = pgdao({ db: db, table: 'task' });
  dao.TaskShare = pgdao({ db: db, table: 'task_share' });
  dao.TaskShareHistory = pgdao({ db: db, table: 'task_share_history' });
  dao.TaskList = pgdao({ db: db, table: 'task_list' });
  dao.TaskListApplication = pgdao({ db: db, table: 'task_list_application' });
  dao.TaskListApplicationHistory = pgdao({ db: db, table: 'task_list_application_history' });
  dao.Community = pgdao({ db: db, table: 'community' });
  return dao;
};
