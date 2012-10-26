var test = require('tap').test
var util = require('util')
var parseView = require('../shared/parse_view')

test("Parse standard elements", function(t){
  var view = "<div>Contents <strong>Some sub content</strong></div>"
  var expected = { 
    elements: 
    [[ 
      'div',{},[ 'Contents ', [ 'strong', {}, [ 'Some sub content' ] ] ] 
    ]],
    sub: [],
    referencedViews: [],
    templates: {},
    bindings: [],
    _isView: true 
  }
  t.deepEqual(parseView(view), expected)
  t.end()
})

// TODO: More tests

test("Parse standard elements with inner view", function(t){
  var view = "<div>Contents <strong>Some sub content</strong> <placeholder t:view='inline_item'/></div>"
  //console.log(util.inspect(parseView(view), false, 10))
  
  var expected = {
    elements:
    [
      ['div',{},[
        'Contents ',['strong', {},['Some sub content']],' ',['placeholder',{
          _view: {name: 'inline_item'}
        },[]]]
      ]
    ],
    sub: [],
    referencedViews: ['inline_item'],
    templates: {},
    bindings: [],
    _isView: true
  }
  t.deepEqual(parseView(view), expected)
  t.end()
})