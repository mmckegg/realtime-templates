Realtime Templates
===

Render views on the server (using standard HTML markup) that the browser can update in realtime when the original data changes.

## Why?

Web pages are increasingly becoming much more than static documents - they display complex, constantly changing information and often allow the user to update that information directly. 

Most templating systems were designed for rendering pages on the server then sending this to the browser to display. This is fast, and efficient allowing the web to work the way it always worked. However anything that we want to work in realtime must be written twice - the code that generates it on the server and the code that knows how to update it in the browser. This is time consuming and error prone.

A more recent concept is to do all of the rendering in the browser itself (popular with single page apps). Essentially the server becomes little more than a database. These systems have a number of problems such as search engine accessibility, initial load speed, and bookmarking. In my opinion this is little more than a hack and completely goes against the original design of the web and browsers. 

Over time fully client side rendering will improve, but this module attempts to get the best of both worlds right now.

## Installation

```shell
$ npm install realtime-templates
```

## The Views

Views are written in pure HTML markup with a few extra attributes to make things work. 

```html
<!--/views/page.html-->
<html>
  <head>
    <title t:bind='title'>My Blog</title>
  </head>
  <body>
    <h1 t:bind='title'>My Blog</h1>
    <h2>Page Title</h2>
    <div>
      <p>I am the page content</p>
    </div>
  </body>
</html>
```

In the example above we have a standard html page with one extra attribute `t:bind`. 

When this view is rendered, it queries the datasource and replaces any existing content with the found value. The final page that gets to the user has no special t:bind type tags - instead just the final document. 

What allows the system to update in realtime is that we send the **full datasource** and **parsed view** (the HTML is parsed into JSON) to the browser along with the rendered page. A little bit of extra meta data is added to the elements so that the system can tell what is what. It's also smart enough to ignore (and leave alone) any extra elements that are added at runtime - e.g. editors / menus / pop-ups.

## Using on the server in Node.js

```js
var http = require('http')

var realtimeTemplates = require('realtime-templates')
var jsonContext = require('json-context')

var viewPath = path.join(__dirname, '/views')

// create a renderer - pass in the path containing the HTML views and any options
var renderer = realtimeTemplates(viewPath, {includeBindingMetadata: true})

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  
  // get the data from the database (or in this case, hard coded JSON)
  var datasource = jsonContext({
    title: "Matt's blog",
    element_id: "value",
    type: 'example'
  })
  
  // render the page and return the result
  renderer.render('page', datasource, function(err, result){
    res.end(result);
  })
  
}).listen(1337, '127.0.0.1');
```

### realtimeTemplates(viewPath, options)

The easy way to use Realtime Templates. Pass in the path to a directory containing your HTML views and it returns a template **renderer**.

Options:
  - **includeBindingData** (defaults `false`): Whether or not to include `data-tx` and `data-ti` attributes on the page to allow realtime updating, and also whether to include the datasource and used views in a script tag at the bottom.
  - **formatters**: Accepts a hash containing named functions representing a custom method of rendering the html from the original value. See Attribute: `t:format`.
  - **masterName**: Pass in the name of a view to use as the overall master layout for all rendered views. Masters must be saved as `<masterName>.master.html`. See Attribute: `t:content`

### renderer.render(viewName, datasource, callback)

**viewName**: Specify the name of a view. It will be the filename minus the `.html`. e.g. For the file `page.html` the viewName would be `page`.

**datasource**: Pass in a datasource object such as [JSON Context](http://github.com/mmckegg/json-context). The renderer will use this data to put the values into the page.

**callback**: function(err, result) where result is the final rendered page in HTML. Errors might be returned if the viewName specified doesn't exist, or there was a fatal problem rendering the page.

### realtimeTemplates.parseView(rawView)

For custom use - pass in a raw HTML template string and it will be parsed into JSON.

### realtimeTemplates.renderView(view, datasource, options)

Pass in a parsed JSON view and a datasource and the function will return an array of RT **elements**. See Attribute: `t:format`.

### realtimeTemplates.generateHtml(elements)

Pass in an array of RT elements and the function returns HTML.

## Binding to a datasource

This module can be used with any datasource object that responds to `query` and `get` and emits `change` events. 

However it was designed to be used with [JSON Context](http://github.com/mmckegg/json-context) - a single object that supports querying (using [JSON Query](https://github.com/mmckegg/json-query)) and contains all data required to render a view/page and providing the client with event stream for syncing with server and data-binding to the dom. 

See [JSON Context](http://github.com/mmckegg/json-context) for more information about the datasource interface.

### Attribute: `t:bind` 

Any time the system hits a `t:bind` attribute while rendering the view, it sends the value of this attribute to the datasource `query` function. The return value is inserted as text inside the element. 

### Attribute: `t:bind:<attribute-name>` 

We can bind arbitrary attributes using the same method by using `t:bind:<attribute-name>`. 

For example, if we wanted to bind an element's ID to `element_id` in our datasource:
```html
<span t:bind:id='element_id'>content unchanged</span>
```

Which would output:
```html
<span id='value'>content unchanged</span>
```

### Attribute: `t:if`

The element will only be rendered if the datasource **returns `true`** when queried with the attribute value.

### Attribute: `t:unless`

The inverse of `t:if`. The element will only be rendered if the datasource **does not return `true`** when queried with the attribute value.

### Attribute: `t:by` and `t:when`

An extension of the if system. Much like a `switch` or `case` statement. Specify the source query using `t:by` then any sub-elements can use `t:when` to choose what value the `t:by` query must return in order for them to show. Multiple values may be specified by separating with the pipe symbol (e.g. `value1|value2|value3`).

```html
<div t:by='type'>
  <div t:when='example'>
    This div is only rendered if the query "type" returns the value "example".
  </div>
  <div t:when='production'>
    This div is only rendered if the query "type" returns the value "production".
  </div>
  <div t:when='trick|treat'>
    This div is rendered when the query "type" returns the value "trick" or "treat".
  </div>
</div>
```

### Attribute: `t:repeat`

For binding to arrays and creating repeating content. The attribute value is queried and the element is duplicated for every item in the returned array.

For this [JSON Context](http://github.com/mmckegg/json-context) datasource:
```js
var datasource = jsonContext({
  posts: [
    {id: 1, title: "Post 1", body: "Here is the body content"},
    {id: 2, title: "Post 2", body: "Here is some more body content"},
    {id: 3, title: "Post 3", body: "We're done."},
  ]
})
```
And this template:
```html
<div class='post' t:repeat='posts' t:bind:data-id='.id'>
  <h1 t:bind='.title'>Will replaced with the value of title</h1>
  <div t:bind='.body'>Will replaced with the value of body</div>
</div>
```
We would get:
```html
<div class='post' data-id='1'>
  <h1>Post 1</h1>
  <div>Here is the body content</div>
</div>
<div class='post' data-id='2'>
  <h1>Post 2</h1>
  <div>Here is some more body content</div>
</div>
<div class='post' data-id='3'>
  <h1>Post 3</h1>
  <div>We're done.</div>
</div>
```

### Attribute: `t:view`

Specify a sub-view to render as the content of the element. It must be in the current viewPath in order to be found.

If the element had content specified, it will be overrided with the content of the subview, but if the subview contains an element with the attribute `t:content`, the removed content will be inserted here. This allows creating views that act like wrappers.

### Attribute: `t:content`

This attribute excepts no value and is used on **master views** to denote where to insert the actual view content.

Say we have this master layout:
```html
<!--/views/layout.master.html-->
<html>
  <head>
    <title>My Blog</title>
  </head>
  <body>
    <h1>My Blog</h1>
    <div t:content id='content'></div>
  </body>
</html>
```
And this view:
```html
<h2>Page title</h2>
<div>I am the page content</div>
```

We would get:
```html
<!--/views/layout.master.html-->
<html>
  <head>
    <title>My Blog</title>
  </head>
  <body>
    <h1>My Blog</h1>
    <div id='content'> <!--inner view is inserted here--> 
      <h2>Page title</h2>
      <div>I am the page content</div>
    </div>
  </body>
</html>
```

### Attribute: `t:format`

This attribute is used to specify a custom renderer to use for rendering the value of `t:bind`. It could be used to apply Markdown or Textile to the original text. 

Formatters are functions that except a value parameter and return an array of elements in RT format. The RT format looks something like this:
```js
// [tag, attributes, sub-elements]
['div', {id: 'content'}, [
  ['h2', {}, [
    {text: 'Page title'}
  ]], 
  ['div', {}, [
    {text: 'I am the page content'}
  ]]
]]
```

Formatters are specified when creating the RT renderer. This example formatter replaces new lines with `<br/>` tags:

```js
function formatMultiLine(input){
  var result = []
  
  input.split('\n').forEach(function(line, i){
    if (i > 0){
      result.push(['br', {}, []])
    }
    result.push({text: line})
  })
  
  return result
}

var renderer = realtimeTemplates(viewPath, {
  includeBindingMetadata: true, 
  formatters: {
    multiline: formatMultiLine //specify the function we created above as a formatter
  }
})
```

## Making it realtime

After the page is loaded in the browser, the system scans for meta tags (`data-tx` and `data-ti`) added by the renderer to figure out what every thing is. It queries the datasource and creates a two way reference between the original object and the element that represents that object.

Then it listens for `change` events on the datasource, using the two way reference to figure out what needs to change, or if it needs to add a new element or remove an existing one.

### Using it with [JSON Context](http://github.com/mmckegg/json-context)

With JSON Context, rather than updating objects directly, we use change streams to push new or changed objects in. This means we have to tell the context how to handle the various changes that could be piped in. It makes sense to have the this map **directly to our database** 1:1. We do this using **matchers**.

We also need a way to identify each object that will need to be changed. Since we made the matchers correspond to our database objects, we can use the unique ID provided by the database.

Say we have the following context:
```js
{
  posts: [
    {id: 1, type: 'post', title: "Post 1", body: "Here is the body content"},
    {id: 2, type: 'post', title: "Post 2", body: "Here is some more body content"},
    {id: 3, type: 'post', title: "Post 3", body: "We're done."},
  ],
  comments: {
    '2': [
      {id: 1, post_id: 2, type: 'comment', name: 'Anonymous Coward' text: "This is dumb"},
      {id: 2, post_id: 2, type: 'comment', name: 'Bill Gates', text: "wish i thought of this!"}
    ]
  } // We have grouped/indexed the comments by post_id as this is how they will be most commonly accessed.
}
```


If we wanted to be able to add comments in realtime, we would add the following matcher:
```js
{
  filter:{
    match: {type: 'comment'}, // we apply the rule if the incoming object has the type 'comment'
    append: true
  },
  item: 'comments[][id={.id}]', // a JSON Query that finds the comment so it can be updated
  collection: 'comments[{.post_id}]' // a JSON Query that specifies where append new items
}
```

When the `includeBindingMetadata` option is enabled, the renderer automatically appends a script tag to the output (with type='text/json' so it won't execute) that contains a full copy of the datasource and the templates used to render it. We can pull that data in and recreate the context in the browser

```js
// client-side require using browserify
var jsonContext = require('json-context')

var bindingElement = document.getElementById('realtimeBindingInfo')
var meta = JSON.parse(bindingElement.innerHTML)

window.context = jsonContext(meta.data, {matchers: meta.matchers})
```

Now we just need to subscribe to the server's change feed. The server will send us the new object, and the matchers are used to figure out if we care and where to update if we do.

```js

  // client-side require using browserify
  var shoe = require('shoe')
  var split = require('split')
  
  shoe('/changes').pipe(split()).on('data', function(line){
    // push the changed objects coming down the wire directly into the context
    window.context.pushChange(JSON.parse(line), {source: 'server'})
  })

```

Here is the view that we will use:
```html
<div t:repeat='posts'>
  <h2 t:bind='.title'></h2>
  <div t:format='multiline' t:bind='.body'></div>
  <div class='comments'>
    <h3>Comments</h3>
    <div t:repeat='comments[{.id}]'>
      <h4 data-bind='.name'></h4>
      <div t:format='multiline' t:bind='.text'></div>
    </div>
  </div>
</div>
```

Let's bind it to the datasource
```js
// client-side require using browserify
var realtimeTemplates = require('realtime-templates')

realtimeTemplates.bind(meta.view, window.context)
```

Now whenever comments are added on the server, they will be updated in realtime in the browser.

The next step is to allow the user to add comments to the page and have these pushed back to the server.

### realtimeTemplates.bind(view, datasource, options)

This must be run in the browser in order for the page to work in realtime. 

**view**: Pass in the parsed view that should be included in a JSON script element with the ID `realtimeBindingInfo` as `view`.

**datasource**: The reconstituted datasource object based on the data included with `realtimeBindingInfo`.`data`

Options:
  - **rootElement** (defaults `document`): A DOM element that corresponds to the root node in the view.
  - **formatters**: Should be hooked up to the same list of formatters as it's server side counterpart. See Attribute: t:format
  - **behaviors**: An object containing a list of functions to be run when is extended with `data-behavior`. See Extending with behaviors

It returns an EventEmitter that emits `append`, `beforeRemove` and `remove` events with a single parameter: `node`. These can be used to add animation or other hooks.

```js
var jsonContext = require('json-context')
var realtimeTemplates = require('realtime-templates')

var bindingElement = document.getElementById('realtimeBindingInfo')
var meta = JSON.parse(bindingElement.innerHTML)

window.context = jsonContext(meta.data, {matchers: meta.matchers})
var binder = realtimeTemplates.bind(meta.view, window.context)

binder.on('append', function(node){
  animations.slideDown(200, node)
})

binder.on('beforeRemove', function(node, wait){
  // wait is a function that can be called to delay (in milliseconds) the actual removal of the element to allow for an animation.
  animations.slideUp(200, node)
  wait(200)
})

```


### context.pushChange(object, changeInfo)

**object**: The complete object that has been changed, created, or deleted. 

**changeInfo** options:
  - **source**: either `server` or `user`. If server the change will not be validated and will be applied to the context regardless. If user, the matcher must explicity allow the type of change ('update', 'append' or 'remove').
  
When a changed object comes down the stream from the server, call `context.pushChange(changedObject, {source: 'server'})` and the change will be merged into the context (as long as there is a corresponding matcher). 

If you want to **update** an object in the browser with a form for example, you must first obtain a copy of the object you wish to change. You can use `context.obtain(query)` to do this, or clone an object using `jsonContext.obtain(element.source)`. Once you have this copy, make the desired changes, then push back in using `context.pushChange(changedObject, {source: 'user'})`. The context will check the matcher to ensure the change they have requested is allowed.

To **delete** an object, obtain in the same way as changing, but add the key `_deleted` with the value `true`.

```js
var object = window.context.obtain(['comments[][id=?]', 1]) // get a copy of the object
object._deleted = true
window.context.pushChange(object, {source: 'user'})
```

If you want to **append** a new object, just push it directly. As long as it has attributes corresponding to the matcher, everything should just work.

## Extending with behaviors

`data-behaviors` attribute

## Preserving attributeson Realtime Nodes (element.preserveAttributes)

If you would like to add a class (or change any other attribute on a DOM node) at runtime using Javascript code rather than via binding, you'll need to set the `preserveAttributes` option to an **array** containing the attribute names you wish the realtime updating to ignore.

```js
var element = document.getElementById('someElement')
element.preserveAttributes = ['style']

slideUp(element, 200) // the animation will now fire correctly, and 
                      // not get tripped up by attribute reset
```

## TODO

 - Testing the browser stuff - maybe with testling or something?
 - Currently preserving elements added at runtime, but would be nice if could also preserve attributes - e.g. additional styles, classes etc.

## Compatibility

The server side will run on Node.js.

Mostly cross-browser when using [shimify](https://github.com/substack/node-shimify) and [browserify](https://github.com/substack/node-browserify).

### Ruby (and other platforms)

With some clever hacking, RT can be run inside a Ruby project using something like [therubyracer](https://github.com/cowboyd/therubyracer). 

I am currently running Realtime Templates inside a Ruby on Rails project in production. I used Browserify to generate a package which could be run directly on therubyracer with no dependencies on Node. I do all of the view loading and parsing in the build step and is pulled into the browserify package precompiled. The data is generated in the ruby code and passed off to a function in therubyracer that renders that data into HTML.

It works remarkably well. My plan is eventually to be running 100% on Node.js, but this has helped to get a little bit of Node niceness into my Rails without huge amounts of infrastructure restructuring.