var OncoKBCard = (function(_, $) {
  var templateCache = {};
  var levels = ['1', '2A', '2B', '3A', '3B', '4', 'R1'];
  var levelDes = {
    '1': '<b>FDA-recognized</b> biomarker predictive of response to an <b>FDA-approved</b> drug <b>in this indication</b>',
    '2A': '<b>Standard of care</b> biomarker predictive of response to an <b>FDA-approved</b> drug <b>in this indication</b>',
    '2B': '<b>Standard of care</b> biomarker predictive of response to an <b>FDA-approved</b> drug <b>in another indication</b> but not standard of care for this indication',
    '3A': '<b>Compelling clinical evidence</b> supports the biomarker as being predictive of response to a drug <b>in this indication</b> but neither biomarker and drug are standard of care',
    '3B': '<b>Compelling clinical evidence</b> supports the biomarker as being predictive of response to a drug <b>in another indication</b> but neither biomarker and drug are standard of care',
    '4': '<b>Compelling biological evidence</b> supports the biomarker as being predictive of response to a drug but neither biomarker and drug are standard of care',
    'R1': '<b>Standard of care</b> biomarker predictive of <b>resistance</b> to an <b>FDA-approved</b> drug <b>in this indication</b>'
  };

  /**
   * Compiles the template for the given template id
   * by using underscore template function.
   *
   * @param templateId    html id of the template content
   * @returns function    compiled template function
   */
  function compileTemplate(templateId) {
    return _.template($("#" + templateId).html());
  }

  /**
   * Gets the template function corresponding to the given template id.
   *
   * @param templateId    html id of the template content
   * @returns function    template function
   */
  function getTemplateFn(templateId) {
    // try to use the cached value first
    var templateFn = templateCache[templateId];

    // compile if not compiled yet
    if (templateFn == null) {
      templateFn = compileTemplate(templateId);
      templateCache[templateId] = templateFn;
    }

    return templateFn;
  }

  function concatAlterations(alterations) {
    var positions = {};
    var regular = [];
    var regExp = new RegExp("([A-Z])([0-9]+)([^0-9/]+)");

    _.each(alterations, function(alteration) {
      var result = regExp.exec(alteration);
      if(result.length === 4) {
        if(!positions.hasOwnProperty(result[2])) {
          positions[result[2]] = {};
        }
        if(!positions[result[2]].hasOwnProperty(result[1])) {
          //Avoid duplication, use object instead of array
          positions[result[2]][result[1]] = {};
        }
        positions[result[2]][result[1]][result[3]] = 1;
      }else {
        regular.push(alteration);
      }
    })

    _.each(_.keys(positions).map(function(e){return Number(e)}).sort(), function(position) {
      _.each(_.keys(positions[position]).sort(), function(aa) {
        regular.push(aa + position + _.keys(positions[position][aa]).sort().join('/'));
      });
    })
    return regular.join(', ');
  }

  function init(data, target) {
    var treatmentTemplates = [];
    var levelTemplates = [];

    _.each(data.treatments, function(treatment) {
      var treatmentFn = getTemplateFn("oncokb-card-treatment-row");

      if(treatment.level){
        treatment.levelDes = levelDes[treatment.level];
      }
      if(_.isArray(treatment.variant)) {
        treatment.variant = concatAlterations(treatment.variant);
      }
      treatmentTemplates.push(treatmentFn(treatment));
    });

    _.each(levels, function(level) {
      var levelFn = getTemplateFn("oncokb-card-level-list-item");
      levelTemplates.push(levelFn({
        level: level,
        levelDes: levelDes[level]
      }));
    });

    var cardMainTemplateFn = getTemplateFn("oncokb-card");
    var cardMainTemplate = cardMainTemplateFn({
      title: data.title,
      oncogenicity: data.oncogenicity || 'Unknown to be oncogenic',
      oncogenicityCitations: data.oncogenicityCitations,
      mutationEffect: data.mutationEffect || 'Pending curation',
      mutationEffectCitations: data.mutationEffectCitations,
      clinicalSummary: data.clinicalSummary,
      biologicalSummary: data.biologicalSummary,
      treatmentRows: treatmentTemplates.join(''),
      levelRows: levelTemplates.join('')
    });

    $(target).html(cardMainTemplate);

    //Remove table element if there is no treatment available
    if (!_.isArray(data.treatments) || data.treatments.length === 0) {
      $(target + ' .oncogenicity table').remove();
    }

    if(!data.oncogenicity) {
      $(target + ' a.oncogenicity').addClass('grey-out');
      $(target + ' a.oncogenicity').addClass('tab-disabled');
    }

    if(!data.mutationEffect) {
      $(target + ' a.mutation-effect').addClass('grey-out');
      $(target + ' a.mutation-effect').addClass('tab-disabled');
    }

    if(!data.biologicalSummary) {
      $(target + ' #mutation-effect').remove();
      $(target + ' a.mutation-effect').removeAttr('href');
      $(target + ' a.oncogenicity').removeAttr('href');
      $(target + ' .enable-hover').each(function() {
        $(this).removeClass('enable-hover');
      });
    }else {
      $(target + ' .oncokb-card ul.tabs').tabs();
    }

    $(target + ' .oncokb-card .collapsible').collapsible();

    $(target + ' .oncokb-card .collapsible').on('click.collapse', '> li > .collapsible-header', function() {
      $(this).find('i.glyphicon-chevron-down').toggle();
      $(this).find('i.glyphicon-chevron-up').toggle();
    });

    // $(target + ' .oncokb-card i.fa-book').each(function() {
    $(target + ' .oncokb-card [qtip-content]').each(function() {
      var element = $(this);
      var content = element.attr('qtip-content');

      if (content) {
        if(element.hasClass('fa-book')) {
          content = '<img src="images/loader.gif" />';
        }
        element.qtip({
          content: content,
          hide: {
            fixed: true,
            delay: 400,
            event: "mouseleave"
          },
          style: {
            classes: 'qtip-light qtip-rounded qtip-shadow oncokb-card-refs',
            tip: true
          },
          show: {
            event: "mouseover",
            delay: 0,
            ready: false
          },
          position: {
            my: element.attr('position-my') || 'center left',
            at: element.attr('position-at') || 'center right',
            viewport: $(window)
          },
          events: {
            render: function(event, api) {
              if(element.hasClass('fa-book')) {
                $.get("http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=" + element.attr('qtip-content')).then(function(articles) {
                  var articlesData = articles.result;
                  var content = '';
                  if (articlesData !== undefined && articlesData.uids.length > 0) {
                    content = '<ul class="list-group" style="margin-bottom: 5px">';

                    articlesData.uids.forEach(function(uid) {
                      var articleContent = articlesData[uid];
                      content += '<li class="list-group-item" style="width: 100%"><a href="http://www.ncbi.nlm.nih.gov/pubmed/' + uid + '" target="_blank"><b>' + articleContent.title + '</b></a>';
                      if (articleContent.authors !== undefined) {
                        content += '<br/><span>' + articleContent.authors[0].name + ' et al. ' + articleContent.source + '. ' + (new Date(articleContent.pubdate)).getFullYear() + ' PMID: '  + articleContent.uid + '</span></li>';
                      }
                    });
                    content += "</ul>";
                  }
                  api.set({
                    'content.text': content
                  });

                  api.reposition(event, false);
                });
              }
            }
          }
        });
      } else {
        $(this).remove();
      }
    })

  }

  return {
    getTemplateFn: getTemplateFn,
    init: init
  }
})(window._, window.$);
