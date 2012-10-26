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

  renderer.render = function(viewName, datasource, cb){
    var startTime = process.hrtime()
    
    if (viewCache[viewName]){
      // read from cache
      var elements = renderView(viewCache[viewName], datasource, options)
      cb(null, generateHtml(elements), {time: process.hrtime(startTime)})
    } else {
      loadView(viewName, function(err, view){                  if(err)return cb&&cb(err);
        assignMasterAndSubViews(view, function(err){          if(err)return cb&&cb(err);
          // cache view if enabled
          if (options.useCache){
            viewCache[viewName] = view
          }
          var elements = renderView(view, datasource, options)
          cb(null, generateHtml(elements), {time: process.hrtime(startTime)})
        })
      })
    }
  }
  
  function viewPath(view){
    return path.join(viewRoot, view + '.html')
  }
  
  
  function loadView(name, cb){
    fs.readFile(viewPath(name), 'utf8', function(err, data){  if (err) return cb&&cb(err);
      cb(null, parseView(data))
    })
  }
  
  function assignMasterAndSubViews(view, cb){
    //TODO: wrap with master
    if (masterName){
      view.referencedViews.push(masterName + '.master')
      // wrap the view elements in a master placeholder
      var placeholder = ['placeholder', {_view: {name: masterName + '.master'}}, view.elements]
      view.elements = [placeholder]
    }
    view.views = {}
    resolveSubViews(view, function(err){
      cb(err, view)
    })
  }
  
  function resolveSubViews(view, viewList, cb){
    if (typeof(viewList) === 'function'){
      cb = viewList
      viewList = null
    }
    viewList = viewList || view.views || {}
    view.referencedViews && asyncEach(view.referencedViews, function(item, next){
      if (viewList[item]){
        next()
      } else {
        loadView(item, function(err, subView){
          if (err) return next(err);
          subView.name = item
          viewList[item] = subView
          resolveSubViews(subView, viewList, next)
        })
      }
    }, function(err){
      if (err) return cb&&cb(err);
      cb()
    })
  }
  
  function getMaster(cb){
    fs.readFile(masterPath, 'utf8', function(err, data){
      if (!err){
        cb(null, data)
      } else { cb&&cb(err) }
    })
  }
  
  return renderer
}

// shortcuts to sub modules
module.exports.renderView = renderView
module.exports.parseView = parseView
module.exports.generateHtml = generateHtml
module.exports.parseView = require('./shared/render_template')



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