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
app-wide configuration settings
*****************/

//called fake credits because they're not worth anything yet: 
//just a dumb counter that keeps counting down and resetting.
const initialFakeCredits = 110;

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
	storage.get( 'currentBook', function( error, cb ) {
		if( ( Object.keys( cb ) ).length ) {
			if( cb.timestamp > ( new Date().getTime() ) ) {
				launchWhisper( cb );
				event.sender.send( 'get-book-response', { error: false, data: cb } );
			} else {
				popNewBook( event );
			}
			
		} else {
			popNewBook( event );
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
app startup items
*****************/

app.on( 'ready', function() { 
	launchMainWindow();
	return;
});

function setDefaults() {
    
    storage.set( 'appDefaults', {
        whisperInterval: 600000,      //600000 means 10 minutes
        whisperDuration: 1200,
        autostart: true
    });

    storage.set( 'fakeCredits', initialFakeCredits );
    
    autolauncher.enable();
    
    return;
}


/*****************
book-related tasks
*****************/

//get a new whisper when the timer runs out; load books if necessary
function popNewBook( event ) {
	
	storage.getMany( [ 'books', 'appDefaults', 'fakeCredits' ], function( error, data ) {
		
		if( data.books.length ) {
			let cb = {};
			cb.book = data.books.shift();
            cb.timestamp = ( new Date().getTime() + data.appDefaults.whisperInterval );
            cb.hostAddress = process.env.DA_HOST;
            cb.creditsRemaining = data.fakeCredits;
			
			launchWhisper( cb );
			event.sender.send( 'get-book-response', { error: false, data: cb } );
			
			//set current book
            storage.set( 'currentBook', cb );
            
            decrementCredits( data.fakeCredits );
			
			//set book array; load more if necesssary
			storage.set( 'books', data.books, function() {
				if( data.books.length < 5 ) {
					prepareLoadBooks( false, event );
				}
			});
			
		} else {
			prepareLoadBooks( true, event );
		}
    });
	
	return;
}

//decrement remaining credits; set back to initial value when depleted
function decrementCredits( credits ) {
    storage.set( 'fakeCredits', ( ( credits - 1 ) < 0 ? initialFakeCredits : credits - 1 ) );
    return;
}

//once we know we need to load more books, ensure defaults and client id are set before loading
function prepareLoadBooks( sendBack, event ) {
	
	storage.get( 'firstRun', function( error, fr ) {
		
		let firstRun = false;
		if( fr ) {	//unset value is {} (e.g., first run)
			firstRun = true;
            setDefaults();
			storage.set( 'firstRun', false );
		}
		
        storage.get( 'clientID', function( error, cid ) {
            
            if( typeof cid !== 'string' ) {     //will be string if already set
                let newClientID = process.platform + randomstring.generate(54);
                storage.set( 'clientID', newClientID, function() {
                    loadBooks( sendBack, event, firstRun, newClientID );
                });
            } else {
                loadBooks( sendBack, event, firstRun, cid );
            }
            
        });
	});	
}

function loadBooks( sendBack, event, firstRun, cid ) {
    
    request( process.env.DA_HOST + '?uid=' + cid + '&callback=?', { json: true }, ( err, res, body ) => {
        if( err ) { 
            storage.get( 'books', function( error, allBooks ) {
                
                if( Array.isArray( allBooks ) ) {
                    if( allBooks.length === 0 ) {
                        event.sender.send( 'get-book-response', { error: true, data: { firstRun: firstRun } } );
                    }
                } else if( ( Object.keys( allBooks ) ).length === 0 ) {
                    event.sender.send( 'get-book-response', { error: true, data: { firstRun: firstRun } } );
                }
            })
            
            return;
        } else {
            
            try {
                let readyToDisplay = transformData( JSON.parse( body.slice( 2, -1 ) ) );
                
                storage.getMany( [ 'books', 'appDefaults', 'fakeCredits' ], function( error, data ) {
                    if( Array.isArray( data.books ) ) {
                        data.books = (data.books).concat( readyToDisplay );
                    } else {
                        data.books = readyToDisplay;
                    }
                    
                    if( sendBack ) {
                        let cb = {};
                        cb.book = (data.books).shift();
                        cb.timestamp = ( new Date().getTime() + data.appDefaults.whisperInterval  );
                        
                        storage.set( 'books', data.books );
                        storage.set( 'currentBook', cb, function() {
                        
                            cb.firstRun = firstRun;
                            cb.hostAddress = process.env.DA_HOST;
                            cb.creditsRemaining = data.fakeCredits;
                        
                            launchWhisper( cb );
                            event.sender.send( 'get-book-response', { error: false, data: cb } );
                        
                            decrementCredits( data.fakeCredits );
                        });
                    } else {
                        storage.set( 'books', data.books );
                    }
                });
            } catch(e) {
                //don't do anything. will silently fail and try loading more books on the next interval.
            }
        }
    });

    //check for software updates every time a new batch of books is requested
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
                    
                    mainWindow.webContents.send( 'new-update-available', { downloadLink: link, updateDetails: body['body'] } );
                }
            }
        }
    });
	
	return;
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

function transformData( json ) {
        
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

function launchWhisper( cb ) {
	
    let { width, height } = electron.screen.getPrimaryDisplay().size;
	
	let iconPic = "";
	if( (process.platform == 'darwin') ) {
		iconPic: path.join( __dirname, '../img/whisper_icon.ico' )
	} else {
		iconPic = path.join( __dirname, '../img/whisper_icon.png' );
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
        icon: iconPic,
        backgroundColor: '#444',
        opacity: 0.8,
		fullscreenable: false,
		focusable: false,
        thickFrame: false,          //only for windows
    });
    
    whisper.loadURL(url.format({
        pathname: path.join( __dirname, '/whisper.html' ),
        protocol: 'file:',
        slashes: true
    }));
    
    //get text to show in whisper notification window
	let authorAndTitle = cb.book.author.split( "," )[0] + ": " + cb.book.title;	//only show first author's name (if there's more than one)
	let supersnipStripped = ( cb.book.supersnip_text ).replace( /<[^>]+>/g, '' );
    supersnipStripped = supersnipStripped.replace( /\n|\r/g, ' ');

    whisper.on( 'ready-to-show', function( w ) {
        whisper.showInactive();
		whisper.webContents.send( "change-whisper-text", { title: authorAndTitle, message: supersnipStripped.substr( 0, 150 ) } );
    });

    whisper.on( 'show', function( w ) {
        storage.get( 'appDefaults', function( error, ad ) {
            setTimeout( function() {
                try {
                    whisper.close();
                } catch(e) {
                    //fail silently
                }
            }, ad.whisperDuration );
        });
        
        return;
    });
    
    whisper.on( 'close', function( w ) {
		whisper = null;
        return;
    });
    
    return;
}

function launchMainWindow() {
	
	let iconPic = "";
	if( (process.platform == 'darwin') ) {
		iconPic: path.join( __dirname, '../img/icon.ico' )
	} else {
		iconPic = path.join( __dirname, '../img/icon.png' );
	}
    
    //create new window
    let { width, height } = electron.screen.getPrimaryDisplay().size;
    height = parseInt(height * 0.75, 10);
    width = parseInt(width * 0.75, 10);
    mainWindow = new BrowserWindow({
        height: ( ( height > 900 ) ? 900 : height ),
        width: ( ( width > 1600 ) ? 1600 : width ),
        backgroundThrottling: false,
        icon: iconPic,
		show: false
    });
    
    //load html in window
    mainWindow.loadURL(url.format({
        pathname: path.join( __dirname, '/index.html' ),
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
shortcuts - these are for debugging only
*****************/

/* electronLocalshortcut.register( 'CommandOrControl+I', () => {
    mainWindow.toggleDevTools();
    //return;
});
electronLocalshortcut.register( 'CommandOrControl+R', () => {
    mainWindow.reload();
    //return;
}); */


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
            },
            { type: 'separator' },
            {
				label: 'v' + app.getVersion(),
				enabled: false
            }
		]
	}
);