var renderTemplate = require('./render_template')

module.exports = function(view, datasource, options){
  // options: formatters, includeBindingMetadata
  options = options || {}
  
  // resolve views if not already
  if (options.views && !view.views){
    view = mergeClone(view, {views: resolveSubViewsFor(view, options.views)})
  }
  
  var elements = renderTemplate(view, datasource.context, {
    datasource: datasource, 
    formatters: options.formatters, 
    view: view, 
    includeBindingMetadata: options.includeBindingMetadata,
    entityHandler: entityHandler
  })
  
  function entityHandler(entity, elements, params){
    // TODO: Handle view switch correctly
    
    if (entity.template){
      // render sub template
      var currentView = params.viewRef && view.views[params.viewRef.name] || view
      var template = currentView.templates[entity.template]
      
      var collection = datasource.get(template.query, params.context)
      if (collection){
        collection.forEach(function(item, i){
          renderTemplate(template, item, {
            datasource: datasource, 
            formatters: options.formatters, 
            includeBindingMetadata: options.includeBindingMetadata,
            view: view, 
            ti: (params.viewRef && params.viewRef.name || '') + ':' + entity.template + ':' + i,
            entityHandler: entityHandler
          }).forEach(function(element){
            elements.push(element)
          })
        })
      }
    }
  }
  
  if (options.includeBindingMetadata){
    
    
    elements.push(['script', {'type': 'application/json', id: 'realtimeBindingInfo'}, [JSON.stringify({data: datasource.data, matchers: datasource.matchers, view: view})]])
  }
  
  return elements
}

function resolveSubViewsFor(view, views){
  var resolvedViews = {}
  view.referencedViews.forEach(function(viewName){
    var subView = views[viewName]
    if (subView){
      resolvedViews[viewName] = views[viewName]
      mergeInto(resolveSubViewsFor(subView, views), resolvedViews)
    }
  })
  return resolvedViews
}

function mergeClone(){
  var result = {}
  for (var i=0;i<arguments.length;i++){
    var obj = arguments[i]
    if (obj){
      Object.keys(obj).forEach(function(key){
        result[key] = obj[key]
      })
    }
  }
  return result
}

function mergeInto(a,b){
  
  var result = b
  if (a){
    Object.keys(a).forEach(function(k){
      result[k] = a[k]
    })
  }

  return result
}