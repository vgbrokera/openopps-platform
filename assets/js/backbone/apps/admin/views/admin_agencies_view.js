var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');
var AdminAgenciesTemplate = require('../templates/admin_agencies_template.html');

var AdminAgenciesView = Backbone.View.extend({

  events: {
    'click #accept-toggle'  : 'toggleAccept',
    'click .link'           : 'link',
    'change #agencies'      : 'changeAgency',
  },

  initialize: function (options) {
    this.options = options;
    this.adminMainView = options.adminMainView;
    this.agencyId = options.agencyId || window.cache.currentUser.agency.agencyId;
  },

  render: function (replace) {
    this.$el.show();
    this.loadAgencyData();
    $('#search-results-loading').hide();
    Backbone.history.navigate('/admin/agency/' + this.agencyId, { replace: replace });
    return this;
  },

  loadAgencyData: function () {
    // get meta data for agency
    $.ajax({
      url: '/api/admin/agency/' + this.agencyId,
      dataType: 'json',
      success: function (agencyInfo) {
        agencyInfo.slug = (agencyInfo.abbr || '').toLowerCase();
        var template = _.template(AdminAgenciesTemplate)({
          agency: agencyInfo,
          departments: this.options.departments,
        });
        this.$el.html(template);
        if(this.options.departments) {
          this.initializeAgencySelect();
        }
      }.bind(this),
    });
  },

  initializeAgencySelect: function () {
    setTimeout(function () {
      $('#agencies').select2({
        placeholder: 'Select an agency',
        allowClear: false,
      });
      try {
        $('#s2id_agencies').children('.select2-choice').children('.select2-search-choice-close').remove();
      } catch (error) { /* swallow exception because close image has already been removed*/ }
    }, 50);
  },

  link: function (e) {
    if (e.preventDefault) e.preventDefault();
    var t = $(e.currentTarget);
    this.adminMainView.routeTarget(t.data('target'), this.data.agency.agencyId);
  },

  toggleAccept: function (e) {
    var toggleOn = $(e.currentTarget).hasClass('toggle-off');
    var state = this.model.attributes.state.toLowerCase();
    if(state == 'open' && !toggleOn) {
      state = 'not open';
    } else if (state == 'not open' && toggleOn) {
      state = 'open';
    }
    $.ajax({
      url: '/api/task/state/' +  this.model.attributes.id,
      type: 'PUT',
      data: {
        id: this.model.attributes.id,
        state: state,
        acceptingApplicants: toggleOn,
      },
      success: function (data) {
        if(toggleOn) {
          $(e.currentTarget).removeClass('toggle-off');
        } else {
          $(e.currentTarget).addClass('toggle-off');
        }
        this.updatePill(state, toggleOn);
      }.bind(this),
      error: function (err) {
        // display modal alert type error
      }.bind(this),
    });
  },

  changeAgency: function (event) {
    if($('#agencies').val()) {
      Backbone.history.navigate('/admin/agency/' + $('#agencies').val(), { trigger: true });
    }
  },

  cleanup: function () {
    removeView(this);
  },

});

module.exports = AdminAgenciesView;
