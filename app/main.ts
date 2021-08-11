import {app, BrowserWindow, screen, clipboard, globalShortcut, Menu, Tray, systemPreferences} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';

const clippings = [];
let tray = null;

const getIcon = () => {
  if (process.platform === 'win32') return 'favicon.png';
  return 'favicon.png';
};

// Initialize remote module
require('@electron/remote/main').initialize();

let win: BrowserWindow = null;
const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

function createWindow(): BrowserWindow {

  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;

  // Create the browser window.
  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve) ? true : false,
      contextIsolation: false,  // false if you want to run e2e test with Spectron
      enableRemoteModule: true // true if you want to run e2e test with Spectron or use remote module in renderer context (ie. Angular)
    },
  });


  if (serve) {
    win.webContents.openDevTools();
    require('electron-reload')(__dirname, {
      electron: require(path.join(__dirname, '/../node_modules/electron'))
    });
    win.loadURL('http://localhost:4200');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html';

    if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
      // Path when running electron in local folder
      pathIndex = '../dist/index.html';
    }

    win.loadURL(url.format({
      pathname: path.join(__dirname, pathIndex),
      protocol: 'file:',
      slashes: true
    }));
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(() => {
      createWindow();
      if (app.dock) app.dock.hide();

      tray = new Tray(path.join(__dirname, getIcon()));
      tray.setPressedImage(path.join(__dirname, 'favicon.png'));

      if (process.platform === 'win32') {
        tray.on('click', tray.popUpContextMenu);
      }

      win = new BrowserWindow({
        show: false,
        skipTaskbar: true
      });
      // win.setSkipTaskbar(true)
      win.loadURL(`file://${__dirname}/index.html`);

      const activationShortcut = globalShortcut.register('CommandOrControl+Option+C', () => {
        tray.popUpContextMenu();
      });

      if (!activationShortcut) console.error('Global activation shortcut failed to regiester');

      const newClippingShortcut = globalShortcut.register('CommandOrControl+Shift+Option+C', () => {
        const clipping = addClipping();
        if (clipping) {
          win.webContents.send('show-notification', 'Clipping Added', clipping);
        }
      });

      if (!newClippingShortcut) console.error('Global new clipping shortcut failed to regiester');

      updateMenu();

      tray.setToolTip('Clipmaster');
    }, 400);
  });

  // // Quit when all windows are closed.
  // app.on('window-all-closed', () => {
  //   // On OS X it is common for applications and their menu bar
  //   // to stay active until the user quits explicitly with Cmd + Q
  //   if (process.platform !== 'darwin') {
  //     app.quit();
  //   }
  // });

  // app.on('activate', () => {
  //   // On OS X it's common to re-create a window in the app when the
  //   // dock icon is clicked and there are no other windows open.
  //   if (win === null) {
  //     createWindow();
  //   }
  // });

  const updateMenu = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Create New Clipping',
        click() {
          addClipping();
        },
        accelerator: 'CommandOrControl+Shift+C'
      },
      {type: 'separator'},
      ...clippings.slice(0, 10).map(createClippingMenuItem),
      {type: 'separator'},
      {
        label: 'Quit',
        click() {
          app.quit();
        },
        accelerator: 'CommandOrControl+Q'
      }
    ]);

    tray.setContextMenu(menu);
  };

  const addClipping = () => {
    const clipping = clipboard.readText();
    if (clippings.includes(clipping)) return;
    clippings.unshift(clipping);
    updateMenu();
    return clipping;
  };

  const createClippingMenuItem = (clipping, index) => {
    return {
      label: clipping.length > 20 ? clipping.slice(0, 20) + '…' : clipping,
      click() {
        clipboard.writeText(clipping);
      },
      accelerator: `CommandOrControl+${index}`
    };
  };

} catch (e) {
  // Catch Error
  // throw e;
}
