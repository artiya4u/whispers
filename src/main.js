const electron = require('electron');
const path = require('path');
const url = require('url');
const request = require('request');
const electronLocalshortcut = require('electron-localshortcut');
const storage = require('electron-json-storage');
const randomstring = require('randomstring');
const dotenv = require('dotenv');
const AutoLaunch = require('auto-launch');

const { app, BrowserWindow, Menu, ipcMain, dialog } = electron;

let mainWindow;
let mainMenuTemplate = []; 


/*****************
crucial app-wide settings
*****************/

const envPath = path.join( ( __dirname ).substring( 0, ( __dirname.length - 4 ) ), '/.env' );
dotenv.config( { path: envPath } );

const autolauncher = new AutoLaunch({
    name: 'Whispers, by 100 Million Books'
});

if( process.platform === 'linux' ) {
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('disable-gpu');
}


/*****************
app-wide listeners
*****************/

//this function is a catch-all for any unhandled errors. it should not ever fire, but 
//it's here just in case, to prevent abrupt program closure in case of an unknown edge case.
process.on( 'uncaughtException', function( e ) {  
    console.log( e );
    dialog.showErrorBox( "Error", "Unknown error. If this keeps happening, tell the developer.");
});


/*****************
interwindow communication
*****************/

//listen for request for new book from main window
ipcMain.on( 'get-next-book', ( event, arg ) => {  
	
	//check books
	storage.get( 'current_book', function( error, cb ) {
		if( ( Object.keys( cb ) ).length ) {
			if( cb.timestamp > ( new Date().getTime() ) ) {
				launch_whisper( cb );
				event.sender.send( 'get-book-response', { error: false, data: cb } );
			} else {
				pop_new_book( event );
			}
			
		} else {
			pop_new_book( event );
		}
	});
	
	return;
});

//listen for autostart setting change from main window
ipcMain.on( 'toggle-autostart', ( event, arg ) => {  
	
    if( arg ) {
        autolauncher.enable();
    } else {
        autolauncher.disable();
    }
    
	return;
});


/*****************
app startup stuff
*****************/

//listen for app to be ready
app.on( 'ready', function() { 
	launch_main_window();
	return;
});

function set_defaults() {
    
    storage.set( 'app_defaults', {
        whisper_interval: 1200000,  //default is 20 minutes
        whisper_duration: 1200,
        autostart: true
    });
    
    autolauncher.enable();
    
    return;
}


/*****************
book-related tasks
*****************/

//get a new whisper when the timer runs out; load books if necessary
function pop_new_book( event ) {
	
	storage.getMany( [ 'books', 'app_defaults' ], function( error, data ) {
		
		if( data.books.length ) {
			let cb = {};
			cb.book = data.books.shift();
			cb.timestamp = ( new Date().getTime() + data.app_defaults.whisper_interval );
			
			launch_whisper( cb );
			event.sender.send( 'get-book-response', { error: false, data: cb } );
			
			//set current book
			storage.set( 'current_book', cb );
			
			//set book array; load more if necesssary
			storage.set( 'books', data.books, function() {
				if( data.books.length < 5 ) {
					prepare_load_books( false, event );
				}
			});
			
		} else {
			prepare_load_books( true, event );
		}
    });
	
	return;
}

//once we know we need to load more books, ensure defaults and client id are set.
function prepare_load_books( send_back, event ) {
	
	storage.get( 'first_run', function( error, fr ) {
		
		let first_run = false;
		if( fr ) {	//unset value is {} (e.g., first run)
			first_run = true;
            set_defaults();
			storage.set( 'first_run', false );
		}
		
        storage.get( 'client_id', function( error, cid ) {
            
            if( typeof cid === 'object' ) {     //will be string if already set
                let new_client_id = process.platform + randomstring.generate(54);
                storage.set( 'client_id', new_client_id, function() {
                    load_books( send_back, event, first_run, new_client_id );
                });
            } else {
                load_books( send_back, event, first_run, cid );
            }
            
        });
	});	
}

function load_books( send_back, event, first_run, cid ) {
    
    request( process.env.DA_HOST + '?uid=' + cid + '&callback=?', { json: true }, ( err, res, body ) => {
        if( err ) { 
            storage.get( 'books', function( error, all_books ) {
                
                if( Array.isArray( all_books ) ) {
                    if( all_books.length === 0 ) {
                        event.sender.send( 'get-book-response', { error: true, data: { first_run: first_run } } );
                    }
                } else if( ( Object.keys( all_books ) ).length === 0 ) {
                    event.sender.send( 'get-book-response', { error: true, data: { first_run: first_run } } );
                }
            })
            
            return;
        } else {
            
            try {
                let ready_to_display = transform_data( JSON.parse( body.slice( 2, -1 ) ) );
                
                storage.getMany( [ 'books', 'app_defaults' ], function( error, data ) {
                    if( Array.isArray( data.books ) ) {
                        data.books = (data.books).concat( ready_to_display );
                    } else {
                        data.books = ready_to_display;
                    }
                    
                    if( send_back ) {
                        let cb = {};
                        cb.book = (data.books).shift();
                        cb.timestamp = ( new Date().getTime() + data.app_defaults.whisper_interval  );
                        
                        storage.set( 'books', data.books );
                        storage.set( 'current_book', cb, function() {
                        
                            cb.first_run = first_run;
                        
                            launch_whisper( cb );
                            event.sender.send( 'get-book-response', { error: false, data: cb } );
                        });
                    } else {
                        storage.set( 'books', data.books );
                    }
                });
            } catch(e) {
                //don't do anything. will silently fail and try loading more books on the next 
            }
        }
    });

    //check for software updates
    request( "https://api.github.com/repos/100millionbooks/whispers/releases/latest", { json: true, headers: { 'User-Agent': 'Whispers' } }, ( err, res, body ) => {
        if( err ) { 
            console.log( "Got error while checking for updates." );
            return;
        } else {

            if( ( typeof body === 'object' ) && body.hasOwnProperty( 'tag_name' ) ) {
                let newestv = body['tag_name'];
                let currentv = 'v' + app.getVersion();
                
                if( newestv !== currentv ) {
                    let link = "";
                    switch( process.platform ) {
                        case 'darwin':
                            link = getDownloadLink( body['assets'], 'darwin' );
                            break;
                        case 'win32':
                            link = getDownloadLink( body['assets'], 'win32' );
                            break;
                        default:
                            link = "https://github.com/100millionbooks/whispers/releases/latest";
                            break;
                    }
                    
                    mainWindow.webContents.send( 'new-updook', cate-available', { download_link: link, update_details: body['body'] } );
                }
            }
        }
    });
}

function getDownloadLink( arr, target ) {
    
	let link = "https://100millionbooks.org";
    const file_type = ( target === 'darwin' ) ? 'application/x-apple-diskimage' : 'application/x-ms-dos-executable';
    
    arr.forEach(function(e) {
        if( e.content_type === file_type ) {
            link = e.browser_download_url;
        }
    });

    return link;
}

function transform_data( json ) {
        
	for( let o in json ) {
					
		if( json[o]['supersnip_text'] ) {
			json[o]['supersnip_text'] = ( json[o]['supersnip_text'] ).substring( 1, ( json[o]['supersnip_text'].length - 1 ) );
			
			if( json[o]['supersnip_text'] ===  "<p class='visual-quote'>If you're seeing this message, you're running an old version of the Chrome extension.<br><br>Please update!</p>" ) {
				json[o]['supersnip_text'] = null;
			}
		}
		
		let year = json[o]['year'];
		
		if( year < 1500 ) {
			if( year < 0 ) {
				year = Math.abs(year) + " BC";
			} else {
				year = Math.abs(year) + " AD";
			}
		}
		
		json[o]['year'] = year;
	}
	
	return json;
}

/*****************
launch windows. whispers are actually little windows styled as notifications.
*****************/

function launch_whisper( cb ) {
	
    let { width, height } = electron.screen.getPrimaryDisplay().size;
	
	let icon_pic = "";
	if( (process.platform == 'darwin') ) {
		icon_pic: path.join( __dirname, '../img/whisper_icon.ico' )
	} else {
		icon_pic = path.join( __dirname, '../img/whisper_icon.png' );
	}
    
    let whisper = new BrowserWindow({
        width: 325, 
        height: 67, 
        x: parseInt(width - 375, 10),
        y: parseInt(height - 157, 10),
        show: false,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        title: "Whisper",
        icon: icon_pic,
        backgroundColor: '#444',
        opacity: 0.8,
		fullscreenable: false,
		focusable: false,
        //darkTheme: true,    
        thickFrame: false,          //only for windows
        //type: 'notification'      //only for linux
    });
    
    whisper.loadURL(url.format({
        pathname: path.join( __dirname, '/whisper.html' ),
        protocol: 'file:',
        slashes: true
    }));
    
    //get text to show in whisper notification window
	let author_and_title = cb.book.author.split( "," )[0] + ": " + cb.book.title;	//only show first author's name
	let supersnip_stripped = ( cb.book.supersnip_text ).replace( /<[^>]+>/g, '' );	//strip html
    supersnip_stripped = supersnip_stripped.replace( /\n|\r/g, ' ');	//strip line breaks

    whisper.on( 'ready-to-show', function( w ) {
        whisper.showInactive();
		whisper.webContents.send( "change-whisper-text", { title: author_and_title, message: supersnip_stripped.substr( 0, 150 ) } );
    });

    whisper.on( 'show', function( w ) {
        storage.get( 'app_defaults', function( error, ad ) {
            setTimeout( function() {
                try {
                    whisper.close();
                } catch(e) {
                    //don't do anything...random and unnecessary
                }
            }, ad.whisper_duration );
        });
        
        return;
    });
    
    whisper.on( 'close', function( w ) {
		whisper = null;
        return;
    });
    
    return;
}

function launch_main_window() {
	
	let icon_pic = "";
	if( (process.platform == 'darwin') ) {
		icon_pic: path.join( __dirname, '../img/icon.ico' )
	} else {
		icon_pic = path.join( __dirname, '../img/icon.png' );
	}
    
    //create new window
    let { width, height } = electron.screen.getPrimaryDisplay().size;
    height = parseInt(height * 0.75, 10);
    width = parseInt(width * 0.75, 10);
    mainWindow = new BrowserWindow({
        height: ( ( height > 900 ) ? 900 : height ),
        width: ( ( width > 1600 ) ? 1600 : width ),
        backgroundThrottling: false,
        icon: icon_pic,
		show: false
    });
    
    //load html in window
    mainWindow.loadURL(url.format({
        pathname: path.join( __dirname, '/main.html' ),
        protocol: 'file:',
        slashes: true
    }));
	
	mainWindow.on( 'ready-to-show', function( w ) {
		mainWindow.maximize();
        mainWindow.show();
	});
    
    //quit app when closed listener
    mainWindow.on('closed', function(){
        app.quit();
        mainWindow = null;
    });
    

    //build menu from template
    const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
    
    //insert menu
    Menu.setApplicationMenu(mainMenu);
    
    return;
}

/*****************
shortcuts
*****************/

//add developer tools option if in dev mode
if( process.env.NODE_ENV === 'development' ) {
    electronLocalshortcut.register( 'CommandOrControl+I', () => {
        mainWindow.toggleDevTools();
        //return;
    });
    electronLocalshortcut.register( 'CommandOrControl+R', () => {
        mainWindow.reload();
        //return;
    });
}


/*****************
set program menus
*****************/

//if OSX, add empty object to menu
if( process.platform == 'darwin' ) {
    mainMenuTemplate.unshift(
        {
            label: app.getName(),
            submenu: [
                {
                    label: 'Preferences',
                    click() { mainWindow.webContents.send( 'open-dialog', 'settings' ); }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }
    );
} else {
    mainMenuTemplate.push(
        {
            label: 'File',
            submenu: [
                {
                    label: 'Settings',
                    click() { mainWindow.webContents.send( 'open-dialog', 'settings' ); }
                },
                { type: 'separator' },
                {
                    role: 'quit'
                }
            ]
        }
	)
};
	
mainMenuTemplate.push(
	{
		label: 'View',
		submenu: [
			{ role: 'zoomin' },
			{ role: 'zoomout' },
			{ type: 'separator' },
			{ role: 'resetzoom' }
		]
	},
	{
		label: 'Help',
		submenu: [
			{
				label: 'About',
				click() { mainWindow.webContents.send( 'open-dialog', 'about' ); }
			},
			{
				label: 'Privacy Policy',
				click() { mainWindow.webContents.send( 'open-dialog', 'privacy' ); }
			},
			{ type: 'separator' },
			{
				label: 'The Occasional Curiosity',
				click() { mainWindow.webContents.send( 'open-dialog', 'oc' ); }
			},
			{
				label: 'The Rediscovery Series',
				click() { mainWindow.webContents.send( 'open-dialog', 'rediscovery' ); }
			},
			{
				label: 'Twitter',
				click() { mainWindow.webContents.send( 'open-dialog', 'twitter' ); }
			},
			{
				label: 'Facebook',
				click() { mainWindow.webContents.send( 'open-dialog', 'facebook' ); }
			}
		]
	}
);