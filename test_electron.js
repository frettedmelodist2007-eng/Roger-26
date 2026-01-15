const electron = require('electron');
console.log('Require electron:', electron);
console.log('Type:', typeof electron);
console.log('App:', electron.app);
if (electron.app) console.log('App is present');
