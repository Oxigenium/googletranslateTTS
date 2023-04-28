At first, specify required constants in settings.js file. You can get file settings.template.js as an example.

Then run script via node using following pattern. If END_ROW is not specified, it will process only one row. If no arguments are specified, then every row will be processed.<br><br>
<strong>node fillAudio.js START_ROW, END_ROW</strong>