
var Log = function( listSelector ) {
    this.listSelector = listSelector;
    this.list = $(listSelector);
};
Log.prototype.debug = function( msg ) {
    // this.list.append(
    //     '<li>' + msg + '</li>'
    // );
    console.log( msg );
};
Log.prototype.d = function( msg ) {
    this.debug( msg );
};
var log = new Log('#log');


/**
 * Processes a list of AJAX calls, saving the result until all calls complete.
 * 
 * @param {LongTaskList}      items [description]
 * @param {Function} progress Callback({
 *                                (Number) iteration,
 *                                ({ID, url}) item,
 *                                (Number) remaining,
 *                                ([item(s)]) queue
 *                            })
 * @param {Function} done     Callback( results )
 */
var LongTask = function( items, progress, done ) {
    this.items = items;
    this.progress = progress;
    this.done = done;
    this.queue = [];
    this.MAX_QUEUE = 5;
    this.results = [];
    this.threadId = -1;
    this.threadSleep = 1 * 1000; // 2 seconds
    this.currentTick = 0; // Just for kicks
    log.d( 'LongTask{.constructor}: initialized with ' + this.items.length + ' tasks' );
};

/**
 * Add an item to the queue
 * 
 * @param  {[type]} item [description]
 * @return {[type]}      [description]
 */
LongTask.prototype.queueItem = function( item ) {
    log.d( 'LongTask.queueItem: adding item to queue, w/ID ' + item.id );
    this.queue.push( item );
};

/**
 * Removes an item from the queue
 * 
 * @param  {Number} id The ID of the item to remove
 * @return {Object}    The item removed
 */
LongTask.prototype.unqueueItem = function( id ) {
    log.d( 'LongTask.unqueueItem: removing item from queue, w/ID ' + id );
    for ( var i in this.queue ) {
        if ( this.queue[i].id === id ) {
            return this.queue.splice( i, 1 );
        }
    }
    throw 'Error: tried to unqueue id# ' + id + ' but failed';
};

LongTask.prototype.fetchItem = function( item ) {
    $.get( item.url, function( data ) {
        this.results.push({
            item: item,
            response: data
        });
        this.unqueueItem( item.id );
    }.bind( this ) );
};

/**
 * Sends a progress update to the caller script.
 * 
 * @param  {[type]} item (Optional) Item being processed
 * @return {[type]}      [description]
 */
LongTask.prototype.updateProgress = function( item ) {
    // Calls the callback given at class instantiation
    this.progress(
        this.currentTick,
        ( item || null ),
        this.items.length,
        this.queue
    );
};

/**
 * Process an AJAX item request
 * 
 * @return {[type]}      [description]
 */
LongTask.prototype.processNextItem = function() {
    
    if ( this.items.length <= 0 ) {
        log.d( 'LongTask.processNextItem: no items left, waiting for queue' );
        return;
    }
    
    var item = this.items.pop();
    
    log.d( 'LongTask.processNextItem: adding item to queue w/ID ' + item.id );
    this.queueItem( item );
    
    log.d( 'LongTask.processNextItem: processing item w/ID ' + item.id );
    this.fetchItem( item );
    
};

/**
 * The main loop, pretending to be a thread
 * 
 * @return {[type]} [description]
 */
LongTask.prototype.tick = function() {
    
    this.currentTick++;
    log.d( 'LongTask.tick: iteration #' + this.currentTick );
    
    this.updateProgress();
    
    // No more items to process
    if ( (this.items.length <= 0) && (this.queue.length <= 0) ) {
        log.d( 'LongTask.tick: no remaining items or queue... invoking callback' );
        this.stop();
        return this.done( this.results );
    }
    
    if ( this.items.length <= 0 ) {
        log.d( 'LongTask.tick: no remaining items, waiting for queue to finish' );
    }
    
    // Queue is full, wait for next tick
    if ( this.queue.length >= this.MAX_QUEUE ) {
        log.d( 'LongTask.tick: queue is full, waiting for next tick' );
        return;
    }
    
    // Pick off another item to process
    log.d( 'LongTask.tick: processing next item' );
    this.processNextItem();
    
};

/**
 * Start processing tasks
 * 
 * @return {[type]} [description]
 */
LongTask.prototype.start = function( thread ) {
    this.threadId = window.setInterval( this.tick.bind(this), this.threadSleep );
};

/**
 * Stop processing tasks
 * 
 * @return {[type]} [description]
 */
LongTask.prototype.stop = function() {
    window.clearInterval( this.threadId );
};