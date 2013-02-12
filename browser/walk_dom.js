module.exports = function(root, iterator, initialContext){

  var currentContext = initialContext
  var contextStack = []

  var currentContextNode = root
  var contextNodeStack = []

  var currentNode = root.firstChild
  while (currentNode){

    var pendingContext = iterator(currentNode, currentContext)

    if (currentNode.firstChild){
      
      // set new context
      if (pendingContext){
        contextStack.push(currentContext)
        contextNodeStack.push(currentContextNode)
        currentContext = pendingContext
        currentContextNode = currentNode
      }

      currentNode = currentNode.firstChild
    } else {

      while (currentNode && !currentNode.nextSibling){
        if (currentNode !== root) {
          currentNode = currentNode.parentNode
          
          // check for clearContext
          if (currentNode === currentContextNode){
            currentContext = contextStack.pop()
            currentContextNode = contextNodeStack.pop()
          }
        } else {
          currentNode = null
        }
      }

      currentNode = currentNode && currentNode.nextSibling
    }

  }

}