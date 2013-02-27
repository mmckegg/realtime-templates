var fs = require('fs')
  , path = require('path')
  , parseView = require('./shared/parse_view')
  , renderView = require('./shared/render_view')
  , generateHtml = require('./shared/generate_html')

module.exports = function(viewRoot, options){
  // options: formatters, includeBindingMetadata, masterName
  
  options = options || {}
  var masterName = options.masterName
  
  var renderer = {}
  
  var viewCache = {}
  var rawViewCache = {}

  renderer.render = function(viewName, datasource, cb){
    var startTime = process.hrtime()

    getResolvedView(viewName, function(err, view){
      var elements = renderView(view, datasource, options)
      cb(null, generateHtml(elements), {time: process.hrtime(startTime)})
    })

  }
  
  function viewPath(viewName){
    return path.join(viewRoot, viewName + '.html')
  }
  
  
  function loadView(viewName, cb){
    fs.readFile(viewPath(viewName), 'utf8', function(err, data){  if (err) return cb&&cb(err);
      cb(null, parseView(data, viewName))
    })
  }

  function getRawView(viewName, cb){
    if (rawViewCache[viewName]){
      cb(null, viewCache[viewName]) 
    } else {
      loadView(viewName, function(err, view){                  if(err)return cb&&cb(err);
        if (options.useCache){
          rawViewCache[viewName] = view
        }
        cb(err, view)
      })
    }
  }

  function getResolvedView(viewName, cb){
    if (viewCache[viewName]){
      cb(null, viewCache[viewName]) 
    } else {
      getRawView(viewName, function(err, view){               if(err)return cb&&cb(err);
        var resolvedView = {$referencedViews: view.$referencedViews, $root: viewName}
        resolveAndAppendViews(view, resolvedView, function(err){    if(err)return cb&&cb(err);
          assignMaster(resolvedView, function(err){       if(err)return cb&&cb(err);
            if (options.useCache){
              rawViewCache[viewName] = resolvedView
            }
            cb(null, resolvedView)
          })
        })

      })
    }
  }

  function resolveAndAppendViews(view, result, cb){
    appendAllStandardAttributesTo(view, result)

    asyncEach(view.$referencedViews, function(k, next){
      getRawView(k, function(err, view){                    if(err)return next&&next(err);
        resolveAndAppendViews(view, result, next)
      })
    }, cb)
  }
  
  function assignMaster(target, cb){
    //TODO: wrap with master
    if (masterName){

      var viewName = masterName + '.master'
      var rootTemplate = target[target.$root]

      // wrap the view elements in a master placeholder
      var placeholder = ['t:placeholder', {_view: viewName}, rootTemplate.elements]
      rootTemplate.elements = [placeholder]

      getRawView(viewName, function(err, view){               if(err)return cb&&cb(err);
        resolveAndAppendViews(view, target, cb)
      })

    } else {
      cb(null)
    }
  }
  
  return renderer
}

// shortcuts to sub modules
module.exports.renderView = renderView
module.exports.parseView = parseView
module.exports.generateHtml = generateHtml
module.exports.parseView = require('./shared/render_template')

function appendAllStandardAttributesTo(original, destination){
  Object.keys(original).forEach(function(key){
    if (key.charAt(0) !== '$'){
      destination[key] = original[key]
    }
  })
}

function asyncEach(collection, iterator, callback){
  var id = -1
    , ended = false
  function end(err){
    ended = true
    if (!err){
      callback()
    } else {callback(err)}
  }
  function next(err, endNow){
    if (!ended){
      if (!err){
        id += 1
        if (id < collection.length && !endNow){
          iterator(collection[id], next)
        } else {          
          end()
        }
      } else {end(err)}
    }
  }
  next()
}