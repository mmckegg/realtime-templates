var generateNodes = require('./generate_nodes')
  , updateAttributes = require('./update_attributes')

module.exports = function(rootNode, newElements, options){
  // options: templateHandler, behaviorHandler
  //var walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT, null, null)
  
  options = options || {}
  
  var templateHandler = options.templateHandler
  options.templateHandler = null
  
  var nodeStack = []
  
  rootNode = rootNode || document
  var currentNode = rootNode
  
  function removeNode(node){
    if (options && options.removeHandler){
      options.removeHandler(node)
    }
    node.parentNode.removeChild(node)
  }
  
  function updateElements(elements){
    elements.forEach(function(e){
      updateElement(e)
      stepForward()
    })
  }
    
  function updateElement(element){
    var movement = moveToElementOrGenerate(element)
    var elementType = getElementType(element)
    
    if (!movement){
      return false
    }
    
    // remove unused content
    movement.skippedNodes.forEach(function(node){
      removeNode(node)
    })
    
    if (elementType === 'element'){
      // if elements was just generated we can skip this step 
      if (!movement.generated){        
        updateAttributes(currentNode, element[1])
        stepIn()
        updateElements(element[2])
        stepOut()
      }

    } else if (elementType === 'text'){
      if (!movement.generated){
        if (currentNode.data !== element.text){
          currentNode.data = element.text
        }
      }
    } else if (elementType === 'template'){
      //if (movement.generated){
      //  console.log("TODO: Need to render templates here", movement)
      //  //TODO: render these templates now (since we don't have them)
      //}
      templateHandler&&templateHandler(element, currentNode, movement.generated)
    }
    
  }
  
  function stepIn(){
    nodeStack.push(currentNode)
    currentNode = currentNode.firstChild
  }
  
  function stepOut(){
    // remove remaining nodes
    if (currentNode){
      while (currentNode.nextSibling){
        removeNode(currentNode.nextSibling)
      }
      removeNode(currentNode)
    }

    currentNode = nodeStack.pop()
  }
  
  function stepForward(){
    if (currentNode){
      currentNode = currentNode.nextSibling
    }
  }
  
  function moveToElementOrGenerate(element){
    var skipped = []
    
    var pos = currentNode    
      
    var searchingFor = parseTx(Array.isArray(element) ? element[1]['data-tx'] : element._tx)
    var searchingForType = getElementType(element)
    
    if (searchingForType === 'template' && !Array.isArray(element.template)){
      debugger
    }
    
    var searching = true
    while (searching && pos){
      if (pos === rootNode || (pos.getAttribute && pos.getAttribute('data-tx') && !pos.getAttribute('data-ti'))){
        
        // must be a standard node created from a view element
        var comparison = txComp(searchingFor, pos.getAttribute('data-tx'))
        if (comparison >= 0){
          searching = false
        } else {
          // this is not the node we are looking for
          skipped.push(pos)
          pos = pos.nextSibling
        }
        
      } else {
        
        if (pos.nodeType == 3){
          
          // text node
          if (searchingForType === 'text' && isNextElementTooFar(pos, searchingFor)){
            searching = false
          } else {
            skipped.push(pos)
            pos = pos.nextSibling
          }
          
        } else if(pos.nodeType === 1 && pos.getAttribute('data-ti')){
          
          // template node - either skip it or move to end if matching
          var ti = pos.getAttribute('data-ti').split(':')
          if (searchingForType === 'template' && ti[0] == element.template[0] && ti[1] == element.template[1]){

            pos = findPlaceholder(pos, element.template.join(':'))
            searching = false
          } else {
            skipped.push(pos)
            pos = pos.nextSibling
          }
          
        } else if (pos.nodeType === 8) {
          
          if (searchingForType === 'template' && element.template.join(':') == pos.data){
            searching = false
          } else {
            skipped.push(pos)
            pos = pos.nextSibling
          }
          
        } else {
          // random node we don't understand (must have been added client side) - just ignore it and pass over
          pos = pos.nextSibling            
        }
        
      }
    }
    
    if (searching){
      
      // node wasn't found .. append to end
      var newNode = generateNodes.generate(element, options)
      var parentNode = nodeStack[nodeStack.length-1]
      if (newNode && parentNode){
        parentNode.appendChild(newNode)
        currentNode = newNode
        return {node: currentNode, generated: true, skippedNodes: skipped}
      } else {
        return false
      }
      
    } else {
      if (isSameType(pos, element) && (!pos.getAttribute || !pos.getAttribute('data-tx') || !txComp(searchingFor, pos.getAttribute('data-tx')))){
          // node was found ... we're done!
          currentNode = pos
          return {node: pos, skippedNodes: skipped}
      } else {
        // node was missing, insert at this point
        var newNode = generateNodes.generate(element, options)
        var parentNode = nodeStack[nodeStack.length-1]
        if (newNode && parentNode){
          parentNode.insertBefore(newNode, pos)
          currentNode = newNode
          return {node: newNode, generated: true, skippedNodes: skipped}
        } else {
          return false
        }
      }
    }
    
  }
  
  //TODO: find a way to handle this automatically
  if (options.isEmbedded){
    updateElement(newElements[0])
  } else {
    currentNode = rootNode.firstChild
    updateElements(newElements)
  }
  
}

function isSameType(node, element){
  if (Array.isArray(element)){
    
    // if behavior has changed, we'll just trash it and regen as 
    // there could be issues with events still bound
    
    return node.nodeType === 1 && node.nodeName === element[0].toUpperCase() && node.getAttribute('data-behavior') == element[1]['data-behavior']
  } else if (element.hasOwnProperty('text')){
    return node.nodeType === 3
  } else {
    return true
  }
}

function isNextElementTooFar(current, tx){
  var nextElement = getNextStandardElement(current)
  return nextElement == null || txComp(tx, nextElement.getAttribute('data-tx')) === 1
}

function findPlaceholder(startingPoint, value){
  var pos = startingPoint
  var searching = true
  while (pos && searching){
    if (pos.nodeType === 8 && pos.data == value){
      return pos
    } else {
      pos = pos.nextSibling
    }
  }
  return null
}

function getNextStandardElement(node){
  var pos = node.nextSibling
  while (pos && (!pos.getAttribute || pos.getAttribute('data-ti') || !pos.getAttribute('data-tx'))){
    pos = pos.nextSibling
  }
  return pos
}

function txComp(txA, txB){
  txA = parseTx(txA)
  txB = parseTx(txB)
  for (var i=0;i<txA.length;i++){
    if (txB[i] == null || txA[i] > txB[i]){
      return -1      
    } else if (txA[i] < txB[i]) {
      return 1
    }
  }
  if (txB.length > txA.length){
    return 1
  } else {
    return 0
  }
}

function parseTx(tx){
  if (tx && typeof tx === 'string'){
    return tx.split('-').map(function(s){return parseInt(s,10)})
  } if (typeof tx === 'number'){
    return [tx]
  } else if (Array.isArray(tx)){
    return tx
  } else {
    return [-1]
  }
}

function getNextTx(node){
  var pos = getNextStandardElement(node)
  if (pos){
    return parseInt(c.getAttribute('data-tx'))
  } else {
    return null
  }
}

function getElementType(element){
  if (Array.isArray(element)){
    return 'element'
  } else {
    if (element.text){
      return 'text'
    } else if (element.template){
      return 'template'
    } else if (element.comment){
      return 'comment'
    }
  }
}

function clearChildren(element){
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}