var updateAttributes = require('./update_attributes')

var self = module.exports = function(elements, options){
  // options: templateHandler, behaviorHandler
  
  var result = []
  elements.forEach(function(element){
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
        var subNodes = self.generate(e, options)
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

      
      if (element.template && Array.isArray(element.template)){
        var placeholder = self.generatePlaceholder(element.template.join(':'))
        if (options && options.templateHandler){
          options.templateHandler(element, placeholder)
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