const { ipcRenderer, remote } = require( 'electron' );
let hostAddress = "";
let intervalTimer = null;
let switchTime = 0;

ipcRenderer.send( 'get-next-book' );


/*****************
receive signals from main
*****************/

ipcRenderer.on( 'get-book-response', ( event, result ) => {  
    
    if( result.error ) {
        $( '.spinner' ).hide();
        $( '#failed-come-again' ).show();
        $( '#book-loading-screen' ).fadeIn();
        
    } else {
        switchTime = result.data.timestamp;
        modTheDom( result.data.book );
        startTimer();
        $( '#book-loading-screen' ).fadeOut();
        $( '#failed-come-again' ).fadeOut();
    }
    
    //set host address every time, in case it's changed in the interim
    hostAddress = result.data.host_address;

    if( result.data.first_run ) {
        setTimeout( function() {
            $( '#about-project' ).modal( { backdrop: 'static', keyboard: false } );
        }, 1500 );
    }
    
    return;
});

ipcRenderer.on( 'open-dialog', ( event, message ) => {
    
    $( '.modal' ).modal( 'hide' );

    switch( message ) {
        case 'settings':
            openSettings();
            break;
        case 'about':
            $( '#about-project' ).modal( 'show' );
            break;
        case 'privacy':
            $( '#privacy-box' ).modal( 'show' );
            break;
        case 'oc':
            $( '#oc-box' ).modal( 'show' );
            break;
        case 'rediscovery':
        $( '#rediscovery-box' ).modal( 'show' );
            break;
        case 'twitter':
        $( '#social-box' ).modal( 'show' );
            break;
        case 'facebook':
        $( '#social-box' ).modal( 'show' );
            break;
    }
});

ipcRenderer.on( 'new-update-available', ( event, data ) => {
    $( '#update-details' ).text( data.update_details );
    $( '#update-available .modal-footer a' ).attr( 'href', data.download_link ) ;
    $( '#update-available' ).modal( { backdrop: 'static', keyboard: false } );
});

ipcRenderer.on( 'pause-resume', ( event, item ) => {
    
    if( item.checked ) {
        clearInterval( intervalTimer );
    } else {
        startTimer();
    }
});


/*****************
book-specific functions
*****************/

function requestBooks() {
    $( '#failed-come-again' ).hide();
    $( '.spinner' ).fadeIn();
    
    setTimeout( function() {
        ipcRenderer.send( 'get-next-book' );
    }, 2000 );
    
    return;
}

function startTimer() {
    
    //set the end time
    setTimeout( function() {
        ipcRenderer.send( 'get-next-book' );
    }, ( switchTime - ( new Date().getTime() ) ) );
    
    //set visual counter
    let minutes = 0; let remainingTime = 0; let remainingTimeUI = "";

    clearInterval( intervalTimer );
    
    remainingTime = ( switchTime - new Date().getTime() ) > 0 ? ( switchTime - new Date().getTime() ) : 0;
    minutes = Math.floor( remainingTime / 60000 );
    remainingTimeUI = minutes + ":" + new Date( remainingTime ).toISOString().substr(17, 2);
    $( "#time-left" ).text( remainingTimeUI );
    
    intervalTimer = setInterval( function() {
        
        remainingTime = ( remainingTime - 1000 ) > 0 ? ( remainingTime - 1000 ) : 0;
        minutes = Math.floor( remainingTime / 60000 )
        remainingTimeUI = minutes + ":" + new Date( remainingTime ).toISOString().substr(17, 2);
        $( "#time-left" ).text( remainingTimeUI );
        
        if( remainingTime <= 0 ) {
            clearInterval( intervalTimer );                   
        } 
        
    }, 1000);
}

//put book data in place
function modTheDom( book ) {
    
    $( '#book-basics .cover-image' ).attr( 'style', "background-image:url(" + book.cover_picture + ")" );
    $( '#book-basics .title' ).text( book.title );
    $( '#book-basics .author' ).text( book.author ); 
    $( '#book-basics .year' ).text( book.year );
    
    $( '#swipe .swipe-container' ).html( book.supersnip_text );
    $( '#swipe .swipe-container .visual-quote' ).append( '<i class="fas fa-quote-left watermark"></i>' );
    
    //remove all appended items before adding new ones
    $( "#swipe-notes, #swipe-tags, #suggestion-credit, #book-links" ).remove();
    
    //add description
    if( book.description ) {
        $( '#info' ).append( "<div id='swipe-notes' class='no-show-scroll'><p class='section-lead'>Description</p><div id='notes-container'>" + book.description + "</div></div>" );
    }
    
    //add tags
    if( book.tags ) {
        let tagsArray = [];
        let tagsHTML = "";
        
        tagsArray = ( book.tags ).split( ',' );
        
        for( let t in tagsArray ) {
            tagsHTML += "<span class='tag'><i class='fas fa-tag'></i> " + tagsArray[t] + "</span>";
        }
        
        $( '#info' ).append( "<div id='swipe-tags'><p>" + tagsHTML + "</p></div>" );
    }
    
    //suggestion credit
    if( book.suggested_by_name ) {
        if( book.suggested_by_link ) {
            let hostname = "";
            hostname = getDomain( book.suggested_by_link );
            
            $( '#info' ).append( "<div id='suggestion-credit'><p class='section-lead'>Suggested By</p><div id='suggestion-container'>" + "<p><img src='https://www.google.com/s2/favicons?domain=" + hostname + "'> " + "<a href='"+book.suggested_by_link+"' target='_blank'> " + book.suggested_by_name + "</a></p>" + "</div></div>" );
            
        } else {
            $( '#info' ).append( "<div id='suggestion-credit'><p class='section-lead'>Suggested By</p><div id='suggestion-container'>" + "<p>"+ book.suggested_by_name + "</p>" + "</div></div>" );
        }
    }
    
    //book links
    if( book.asin || book.isbn10 ) {
    
        let linksHTML = "";

        if( book.asin ) {
            linksHTML += "<span class='tag'><a class='gr " + book._id + "' href='https://www.goodreads.com/book/isbn/" + book.asin + "'><i class='fas fa-external-link-alt'></i> Goodreads</a></span>";
            linksHTML += "<span class='tag'><a class='amz " + book._id + "' href='https://www.amazon.com/dp/" + book.asin + "'><i class='fas fa-external-link-alt'></i> Amazon</a></span>";
        }
        if( book.isbn10 ) {
            linksHTML += "<span class='tag'><a class='lt " + book._id + "' href='https://www.librarything.com/isbn/" + book.isbn10 + "'><i class='fas fa-external-link-alt'></i> LibraryThing</a></span>";
        }
        
        $( '#info' ).append( "<div id='book-links'><p class='section-lead'>See More</p><p>" + linksHTML + "</p></div>" );
    }
    
    //share link
    $( '#fond-actions input' ).attr( 'value', "https://100millionbooks.org/snippet?uid=" + book.uid );

    return;
}

//people who suggest books can include a link to their social profiles. this function gets
//the root of that domain in order to show the favicon in the interface.
function getDomain(url) {
    
    url = url.replace(/(https?:\/\/)?(www.)?/i, '');
    url = url.split('.');
    url = url.slice(url.length - 2).join('.');

    if (url.indexOf('/') !== -1) {
        return url.split('/')[0];
    }

    return url;
}


/*****************
process email input
*****************/

function saveEmail() {
    
    $( "#stay-in-touch .modal-footer i.get-email-status" ).hide();
    $( "#stay-in-touch .modal-footer i.get-email-status.loading" ).fadeIn();
    
    let userEmailInput = $( "#stay-in-touch .modal-body input[type='email']" ).val();
    
    let re = /\S+@\S+/;
    if( ( userEmailInput.length !== 0 ) && ( re.test( userEmailInput ) ) ) {
        
        $.getJSON( hostAddress + '?get_new_email_address=' + encodeURIComponent(userEmailInput) + '&client=' + process.platform + '&callback=?' )

        .done( function() {
            
            $( "#stay-in-touch .modal-footer i.get-email-status" ).hide();
            $( "#stay-in-touch .modal-footer i.get-email-status.success" ).fadeIn();
            
            setTimeout( function() {
                $( '#stay-in-touch' ).modal( 'hide' );
                $( "#stay-in-touch .modal-footer i.get-email-status" ).hide();
                $( "#stay-in-touch .modal-body input[type='email']" ).val( "" );
            }, 1200 );
        })
        
        .fail( function() {
            $( "#stay-in-touch .modal-footer i.get-email-status" ).hide();
            $( "#stay-in-touch .modal-footer i.get-email-status.fail" ).fadeIn();
        });
        
        
    } else {
        $( "#stay-in-touch .modal-footer i.get-email-status" ).hide();
        $( "#stay-in-touch .modal-footer i.get-email-status.fail" ).fadeIn();
    }
    
    return;
}


/*****************
settings stuff
*****************/

function openSettings() {

    $( '#app-settings' ).modal( 'show' );
        
    remote.require('electron-json-storage').get( 'app_defaults', function( error, ad ) {
        $('#setting-whisper-interval input').val( ad.whisper_interval / 60000 );
        $('#setting-whisper-duration input').val( ad.whisper_duration );
        
        $( '#setting-whisper-interval .setting-readout span' ).text( ad.whisper_interval / 60000 )
        $( '#setting-whisper-duration .setting-readout span' ).text( ad.whisper_duration );
        
        if( ad.autostart ) {
            $( '#setting-autostart input' ).bootstrapToggle( 'on' );
        } else {
            $( '#setting-autostart input' ).bootstrapToggle( 'off' );
        }
    });
    
    return;
}

function setSettings() {
    
    const autostart = $( '#setting-autostart input' ).prop('checked');
    
    remote.require('electron-json-storage').set( 'app_defaults', {
        whisper_interval: ( $( '#setting-whisper-interval input' ).val() ) * 60000,
        whisper_duration: $( '#setting-whisper-duration input' ).val(),
        autostart: autostart
    });
    
    ipcRenderer.send( 'toggle-autostart', autostart );
    
    return;
}


/*****************
dom stuff
*****************/

$( document ).ready( function() {

    //activate all tooltips
    $('[data-toggle="tooltip"]').tooltip();
    
    //fade out title loading screen every time this window is opened
    setTimeout( function() {
        $( '#loading-screen' ).fadeOut();
    }, 2000 );
    
    //request reload from fail screen
    $( '#failed-come-again button' ).on( 'click', function() {
        requestBooks();
        return;
    });

    //automatically highlight shareable link when input is clicked
    $( '#fond-actions input' ).on( 'click', function() {
        this.select();
        return;
    });
    
    //show about modal
    $( '#about-button' ).on( 'click', function() {
        $( '#about-project' ).modal( 'show' );
    });
    
    //hide about modal and show email modal
    $( '#about-project .modal-footer button' ).on( 'click', function() {
        $( '#about-project' ).modal( 'hide' );
        $( '#stay-in-touch' ).modal( 'show' );
        $( "#stay-in-touch input[type='email']" ).focus()
    });
    
    //show settings modal
    $( '#settings-button' ).on( 'click', function() {
        openSettings(); 
    });
    
    $( 'button.settings-done' ).on( 'click', function() {
        $( '#app-settings' ).modal( 'hide' );
    });


    /*****************
    handle changes in settings...code in this section needs to be refactored.
    *****************/
    
    $('#setting-whisper-interval input').on( 'change', function() {
        $( '#setting-whisper-interval .setting-readout span' ).text( $('#setting-whisper-interval input').val() );
        setSettings();
        return;
    });
    
    $('#setting-whisper-duration input').on( 'change', function() {
        $( '#setting-whisper-duration .setting-readout span' ).text( $('#setting-whisper-duration input').val() );
        setSettings();
        return;
    });
    
    $('#setting-autostart input').on( 'change', function() {
        setSettings();
        return;
    });
    
    /*****************
    *****************/

    //hide email modal or register email if requested
    $( '#stay-in-touch .modal-footer button.no-thanks' ).on( 'click', function() {
        $( '#stay-in-touch' ).modal( 'hide' );
    });
    $( '#stay-in-touch .modal-footer button.send-email' ).on( 'click', function() {
        //$( '#stay-in-touch' ).modal( 'hide' );
        saveEmail();
    });
    
    $( "#stay-in-touch input[type='email']" ).keypress( function(e) {
        if (e.which == 13) {
            saveEmail();
        }
    });
    
    //force all external links to open in default system browser
    $( document ).on( 'click', 'a[href^="http"]', function( event ) {
        event.preventDefault();
        remote.require('electron').shell.openExternal( this.href );

        //count click if it's to get more information about a book
        const dest = this.classList[0]; const bookID = this.classList[1];
        const destinationsToRecord = [ 'gr', 'amz', 'lt' ];
        if( destinationsToRecord.includes(dest) ) {
            $.getJSON( hostAddress + "?bo=" + bookID + "&cl=" + dest + "&callback=?" );
        }
    });
});