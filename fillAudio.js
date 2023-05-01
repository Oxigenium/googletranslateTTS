const http = require('http');
const fs = require('fs');
const Stream = require('stream')
const { GoogleSpreadsheet } = require('google-spreadsheet');

const {API_KEY, SHEET_ID, MIN_TIME, MAX_TIME, LANG, ANKI_DIR, WORD_COLUMN, DICT_SHEET_NAME} = require('./settings.js')
const doc = new GoogleSpreadsheet(SHEET_ID);
const args = process.argv

transformWords(+args[2],+args[3] || +args[2])

async function transformWords(startRow = 2, endRow) {
	if (!isNaN(startRow) && (endRow < startRow || startRow < 2)) {
		console.error('Wrong interval!')
		return
	}
	if (isNaN(startRow) && isNaN(endRow)) {
		startRow = 2
	}
	var hebrewWords = await getWords(startRow, endRow)
	// console.log(hebrewWords) 
	var catalog = hebrewWords.map((w, i) => ({word: w, i:i+startRow-1, fileName: `word_${i+startRow}.mp3`}))
	var notEmptyCatalog = catalog.filter(e=>e.word)
	var delays = getDelays(notEmptyCatalog.length)

	console.log(`Start generating audiorecords from ${startRow} to ${endRow || hebrewWords.length+1}, estimated time to finish: ${Math.ceil(delays.reduce((acc, v) => acc+v)/1000)}s`)

	listToAudios({language:LANG, dir:ANKI_DIR, list: notEmptyCatalog.map(e=>[e.word,e.fileName])}, function () {
		// saveToFileCallback('./files/catalog.txt')(combineCatalogFile(catalog))
	}, delays)
}

async function getWords(startRow = 2, endRow) {
	await doc.useApiKey(API_KEY);
	await doc.loadInfo(); // loads document properties and worksheets
	const sheet = doc.sheetsByTitle[DICT_SHEET_NAME]
	var rows = await sheet.getRows()

	return rows.map(r=>r[WORD_COLUMN])
		.reduceRight((acc, val) => {
		    if (val !== '' || acc.length > 0) {
		      acc.unshift(val);
		    }
		    return acc;
		  }, [])
		.slice(startRow-2, endRow ? endRow-1 : undefined)
}

function combineCatalogFile(catalog) {
	return stringToStream(catalog.map(e=> e.word ? e.fileName : '').join('\n'))
}

function getDelays(size, minTime = MIN_TIME, maxTime = MAX_TIME) {
	return Array.from({ length: size }, () => minTime + Math.random()*(maxTime-minTime));
}

/**
 * Example: listToAudios({language: "he", dir: './', list: [
 *	  ['כּלוּם/שוּם דָבָר', 'nothing.wav'],
 *	  ['מַה קוֹרֶה', 'happening.wav']
 *	]})
 */
function listToAudios(config,callback, delays = undefined) {
	var fileNames = []
	spreadInTime(phraseToSpeech, config.list.map(entry => [entry[0],config.language,saveToFileCallback(config.dir + entry[1], function(fileName) {
		fileNames.push(fileName)
	})]), function() {
		if (typeof callback === 'function')
			callback(fileNames)
	}, delays)
}

function stringToStream(str) {
	const stream = new Stream.Readable()
	stream._read = () => {}
	stream.push(str)
	stream.push(null)
	return stream
}


/**
 * Example: spreadInTime(phraseToSpeech, [
 *	['Привет', 'ru', saveToFileCallback('./Hi.wav')],
 *	['Как дела', 'ru', saveToFileCallback('./How.wav')],
 *	['Что делаешь', 'ru', saveToFileCallback('./What.wav')],
 *	['Пока', 'ru', saveToFileCallback('./Bye.wav')]])
 */

function spreadInTime(action, listOfListOfargs, callback, delays = undefined, minTime = MIN_TIME, maxTime = MAX_TIME) {
	if (!listOfListOfargs || !listOfListOfargs.length) {
		if (typeof callback === 'function')
			callback()
		return
	}
	if (typeof delays === 'object' && listOfListOfargs.length != delays.length) {
		console.log('Wrong length of delays array')
		return
	}
	action(...listOfListOfargs.shift())
	if (!listOfListOfargs.length) {
		if (typeof callback === 'function')
			callback()
		return
	}
	setTimeout(function () {
		spreadInTime(action, listOfListOfargs, callback, delays, minTime, maxTime)
	}, !!delays ? delays.shift() : minTime + Math.random()*(maxTime-minTime));
}

function saveToFileCallback(fileName, callback) {
	return function (data) {
		data.pipe(fs.createWriteStream(fileName))
		console.log(`File ${fileName} saved successfully!`)
		if (typeof callback === 'function')
			callback(fileName)
	}
}

/**
 * Get audio for given phrase in given language.
 * Must be used with interval to not be banned for unathorized usage.
 *
 * Example: phraseToSpeech('Привет', 'ru', saveToFileCallback('./test.wav'))
 */
function phraseToSpeech(phrase, language, callback) {
	var link = `http://translate.google.com/translate_tts?ie=UTF-8&tl=${language}&client=tw-ob&q=${phrase}`
	http.get(link, callback);
}