var updateAttributes = require('./update_attributes')
  , mergeClone = require('../shared/merge_clone')


var self = module.exports = function(elements, options){
  // options: templateHandler, behaviorHandler, parentNode
  
  var result = []
  elements.forEach(function(element){
    if (element.parentAttributes){
      // append placeholder element's attributes to parent node
      if (options && options.parentNode){
        updateAttributes(options.parentNode, element.parentAttributes, {append: true})
      }
    } else {
      // recursively render all elements
      var node = self.generate(element, options)
      if (node){
        if (Array.isArray(node)){
          node.forEach(function(n){
            result.push(n)
          })
        } else {
          result.push(node)
        }
      }
    }
  })
  return result
}

self.generate = function(element, options){
  
  if (Array.isArray(element)){
    
    // standard element
    var newNode = document.createElement(element[0])
    
    updateAttributes(newNode, element[1])
    
    if (element[2]){
      element[2].forEach(function(e){
        // recursively render all elements
        var subNodes = self.generate(e, mergeClone(options, {parentNode: element}))
        if (Array.isArray(subNodes)){
          subNodes.forEach(function(node){
            newNode.appendChild(node)
          })
        } else if (subNodes){
          newNode.appendChild(subNodes)
        }
      })
    }

    if (options.behaviorHandler && element[1]['data-behavior']){
      options.behaviorHandler(newNode)
    }
    
    return newNode
     
    
  } else if (element instanceof Object){
    // entity: e.g. Template
    
    if (element.hasOwnProperty('text')){
      return document.createTextNode(element.text || '')
    } 
    if (element.comment){
      return document.createComment(element.comment.toString())
    } else {

      
      if (element.template){
        var placeholder = self.generatePlaceholder(element.template)
        if (options && options.templateHandler){
          options.templateHandler(element, placeholder, true)
        }
        return placeholder
      }
      
    }
    
    
  } else {
    // text node
    if (element != null && element.toString){
      return document.createTextNode(element.toString())
    }
  }
}

self.generatePlaceholder = function(templateId){
  return document.createComment(templateId)
}