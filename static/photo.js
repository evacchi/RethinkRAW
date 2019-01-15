void function () {

let form = document.getElementById('settings');
let changed = false;

document.body.onload = async () => {
    let settings = await jsonRequest('GET', `/photo/${template.Path}?settings`);
    let processChanged = false;

    if (settings.process == null || settings.process < 6.7 || settings > 11) {
        if (settings.process) window.alert('This file was processed with an incompatible version of Camera Raw.\nPrevious edits will not be faithfully reproduced.');
        settings.process = 11;
        processChanged = true;
    }
    if (settings.process < 11 && window.confirm('This file was processed with an older version of Camera Raw.\nPrevious edits may not be faithfully reproduced.\n\nUpdate to the current Camera Raw process version?')) {
        settings.process = 11;
        processChanged = true;
    }

    form.orientation.value = settings.orientation;
    form.process.value = settings.process;
    form.profile.value = settings.profile;
    form.lensProfile.checked = settings.lensProfile;
    form.autoLateralCA.checked = settings.autoLateralCA;

    treatmentChange(form.grayscale, settings.grayscale);
    temperatureInput(form.temperature, settings.temperature);
    whiteBalanceChange(form.whiteBalance, settings.whiteBalance);

    let tone = 'Default';
    for (let k of ['exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'vibrance', 'saturation']) {
        if (settings[k] !== 0) tone = 'Custom';
        rangeInput(form[k], settings[k]);
    }
    for (let k of ['tint', 'clarity', 'dehaze', 'sharpness', 'luminanceNR', 'colorNR']) {
        rangeInput(form[k], settings[k]);
    }

    if (settings.autoTone) tone = 'Auto';
    toneChange(form.tone, tone);
    changed = processChanged;

    for (let n of form.querySelectorAll('fieldset')) {
        n.disabled = false;
    }
}

window.onbeforeunload = function () {
    if (changed) return 'Do you want to leave this page? Changes you made may not be saved.';
}

window.valueChange = function () {
    let spinner = document.getElementById('spinner');
    let photo = document.getElementById('photo');
    let done = true;
    let query;

    function delayed() {
        query = formQuery();
        spinner.hidden = false;
        photo.onload = loaded;
        photo.src = `/photo/${template.Path}?preview&` + query;
    }

    function loaded() {
        if (query === formQuery()) {
            spinner.hidden = true;
            done = true;
        } else {
            done = false;
            setTimeout(delayed, 0);
        }
    }

    return () => {
        changed = true;
        if (done) {
            done = false;
            setTimeout(delayed, 0);
        }
    };
}();

window.orientationChange = function (op) {
    const table = {
        ccw: [8, 8, 5, 6, 7, 4, 1, 2, 3],
        cw:  [6, 6, 7, 8, 5, 2, 3, 4, 1],
        hz:  [2, 2, 1, 4, 3, 6, 5, 8, 7],
        vt:  [4, 4, 3, 2, 1, 8, 7, 6, 5],
    };

    let orient = table[op][form.orientation.value]
    if (orient === void 0) orient = table[op][0];
    form.orientation.value = orient;

    valueChange();
}

window.treatmentChange = function (e, v) {
    const profiles = [
        ['Adobe Standard'],
        ['Adobe Standard'],
    ];

    if (v !== void 0) e.value = v;
    let color = e.value === 'false';
    if (e.length === 2) e = e[0];

    let profile = e.form.profile;
    profile.innerHTML = '';
    for (let o of profiles[+color]) {
        profile.insertAdjacentHTML('beforeend', `<option>${o}</option>`);
    }
    for (let n of e.form.querySelectorAll('div.color')) {
        n.classList.toggle('disabled-color', !color);
        disableInputs(n);
    }

    valueChange();
}

window.whiteBalanceChange = function (e, v) {
    const presets = {
        Daylight:   { temperature: 5500, tint: 10 },
        Cloudy:     { temperature: 6500, tint: 10 },
        Shade:      { temperature: 7500, tint: 10 },
        Tungsten:   { temperature: 2850, tint:  0 },
        Fluorescent:{ temperature: 3800, tint: 20 },
        Flash:      { temperature: 5500, tint:  0 },
    }

    if (v !== void 0) e.value = v;

    let temp = e.form.temperature;
    let tint = e.form.tint;
    let auto = false;
    if (e.value in presets) {
        let k = presets[e.value].temperature;
        let t = presets[e.value].tint;
        tint[0].value = t;
        tint[1].value = t;
        temp[0].value = k;
        temp[1].value = Math.log(k);
    } else if (e.value !== 'Custom') {
        auto = true;
    }
    for (let n of e.form.querySelectorAll('div.manualWB')) {
        n.classList.toggle('disabled-wb', auto);
        disableInputs(n);
    }

    valueChange();
}

window.toneChange = function (e, v) {
    if (v !== void 0) e.value = v;

    if (e.value === 'Default') {
        for (let i of e.form.querySelectorAll('div.customTone input')) {
            i.value = 0;
            rangeInput(i);
        }
    }
    let auto = e.value === 'Auto';
    for (let n of e.form.querySelectorAll('div.customTone')) {
        n.classList.toggle('disabled-tone', auto);
        disableInputs(n);
    }

    valueChange();
}

window.temperatureInput = function (e, v) {
    if (e.length === 2) e = e[1];
    if (v !== void 0) e.value = Math.log(v);

    let n = Math.exp(Number(e.value));

    let r = n < 4000 ? 50 :
            n < 8000 ? 100 :
            n < 20000 ? 200 :
            n < 40000 ? 500 : 1000;

    e.previousElementSibling.value = Math.round(n / r) * r;
}

window.rangeInput = function (e, v) {
    if (e.length === 2) e = e[1];
    if (v !== void 0) e.value = v;

    let n = Number(e.value);
    let s = formatNumber(e.value, e.step);
    if (n > 0 && e.min < 0 && s !== '0') s = '+' + s;
    e.previousElementSibling.value = s;
}

window.setCustomWhiteBalance = () => form.whiteBalance.value = 'Custom';
window.setCustomTone = () => form.tone.value = 'Custom';

window.exportFile = function (state) {
    if (state === 'dialog') {
        exportChange(document.getElementById('export-form'));
        let dialog = document.getElementById('export-dialog');
        dialog.onclose = () => dialog.returnValue && exportFile(dialog.returnValue);
        dialog.showModal();
        return;
    }
    let query = formQuery();
    if (state === 'export') query += '&' + exportQuery();
    window.location = `/photo/${template.Path}?export&` + query;
    setTimeout(c => changed = c, 0, changed);
    changed = false;
}

window.exportChange = function (e) {
    let form = e.tagName === 'FORM' ? e : e.form;

    document.getElementById('export-dng').hidden = form.format.value !== 'DNG';
    document.getElementById('export-jpeg').hidden = form.format.value !== 'JPEG';

    // density unit changed?
    let newden = form.denunit.value;
    let oldden = form.denunit.previousValue;
    if (oldden && oldden !== newden) {
        let min, max, val;
        if (newden === 'ppi') {
            min = 72;
            max = 600;
            val = (form.density.value * 2.5) || 300;
        } else {
            min = 28;
            max = 240;
            val = (form.density.value / 2.5) || 120;
        }
        form.density.min = min;
        form.density.max = max;
        if (val < min) val = min;
        if (val > max) val = max;
        form.density.value = Math.round(val);
    }
    form.denunit.previousValue = newden;

    // dimension unit changed?
    let newdim = form.dimunit.value;
    let olddim = form.dimunit.previousValue;
    if (olddim && olddim !== newdim) {
        let mul = 1;
        let ppi = Number(form.density.value) || 300;
        if (newden !== 'ppi') ppi *= 2.5;
        if (olddim === 'in') mul = ppi;
        if (olddim === 'cm') mul = ppi / 2.5;
        if (newdim === 'in') mul /= ppi;
        if (newdim === 'cm') mul /= ppi / 2.5;

        let min, max, step;
        switch (newdim) {
            case 'in':
                min = 1;
                max = 40;
                step = 0.01;
                break;
            case 'cm':
                min = 2.5;
                max = 100;
                step = 0.01;
                break;
            default:
                min = 80;
                max = 5120;
                step = 1;
                break;
        }

        for (let k of ['long', 'short', 'width', 'height']) {
            let e = form[k];
            let x = e.value * mul;

            e.min = min;
            e.max = max;
            e.step = step;
            if (x) {
                if (x < min) x = min;
                if (x > max) x = max;
                e.value = x;
            }
        }
    }
    form.dimunit.previousValue = newdim;

    // disable/hide/format/require
    let resample = form.resample.checked;
    let dims = form.fit.value === 'dims';
    let mpix = form.fit.value === 'mpix';
    let dens = form.dimunit.value !== 'px' && !mpix;

    for (let k of ['quality', 'fit', 'long', 'short', 'width', 'height', 'dimunit', 'density', 'denunit', 'mpixels']) {
        form[k].disabled = !resample;
    }

    if (resample) {
        form.density.disabled = !dens;
        form.denunit.disabled = !dens;
        form.dimunit.disabled = mpix;
        form.mpixels.disabled = !mpix;

        if (mpix) {
            form.long.disabled = true;
            form.short.disabled = true;
            form.width.disabled = true;
            form.height.disabled = true;
        } else {
            form.long.disabled = !dims;
            form.short.disabled = !dims;
            form.width.disabled = dims;
            form.height.disabled = dims;
        }
    }
    if (!mpix) {
        form.long.hidden = !dims;
        form.short.hidden = !dims;
        form.width.hidden = dims;
        form.height.hidden = dims;
    }

    formatElement(form.long);
    formatElement(form.short);
    formatElement(form.width);
    formatElement(form.height);
    formatElement(form.mpixels);
    form.long.required = form.short.value == '';
    form.short.required = form.long.value == '';
    form.width.required = form.height.value == '';
    form.height.required = form.width.value == '';
    form.density.required = true;
    form.mpixels.required = true;

    function formatElement(e) { if (e.value !== '') e.value = formatNumber(e.value, e.step); }
}

function disableInputs(n) {
    let disabled = n.className.includes('disabled');
    for (let i of n.getElementsByTagName('input')) {
        i.disabled = disabled;
    }
}

function formQuery() {
    let query = [];

    if (form.tone.value === 'Auto') query.push('autoTone=1');

    for (let k of ['orientation', 'process', 'grayscale', 'whiteBalance']) {
        query.push(k + '=' + encodeURIComponent(form[k].value));
    }
    for (let k of ['temperature', 'tint', 'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'clarity', 'dehaze', 'vibrance', 'saturation', 'sharpness', 'luminanceNR', 'colorNR']) {
        if (form[k][0].value == 0) continue;
        query.push(k + '=' + encodeURIComponent(form[k][0].value));
    }
    for (let k of ['lensProfile', 'autoLateralCA']) {
        if (form[k].checked) query.push(k + '=1');
    }

    return query.join('&');
}

function exportQuery() {
    let form = document.getElementById('export-form')
    let query = [];

    if (form.format.value === 'DNG') {
        query.push('dng=1');
        query.push('preview=' + encodeURIComponent(form.preview.value));
        for (let k of ['fastload', 'embed', 'lossy']) {
            if (form[k].checked) query.push(k + '=1');
        }
    } else {
        let resample = form.resample.checked;
        if (!resample) return '';

        query.push('resample=1');
        for (let k of ['quality', 'fit', 'long', 'short', 'width', 'height', 'dimunit', 'density', 'denunit', 'mpixels']) {
            query.push(k + '=' + encodeURIComponent(form[k].value));
        }
    }

    return query.join('&');
}

function jsonRequest(method, url, body) {
    return new Promise((resolve, reject) => {
        if (body !== void 0) body = JSON.stringify(body);
        let xhr = new XMLHttpRequest();
        xhr.responseType = 'json';
        xhr.open(method, url);
        xhr.onload = () => {
            if (200 <= xhr.status && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = () => reject({
            status: xhr.status,
            statusText: xhr.statusText
        });
        xhr.send(body);
    });
}

function formatNumber(value, step) {
    step = Number(step);
    if (!Number.isFinite(step)) return value.toString();

    let fmt = step.toString();
    if (fmt.indexOf('e') >= 0) return value.toString();

    let val = Number(value);
    let i = fmt.indexOf('.');
    if (i < 0) return val.toFixed(0);
    return val.toFixed(fmt.length - i - 1);
}

let passive = { passive: true };

function keyboardEventListener(evt) {
    if (evt == null) evt = window.event;
    for (let n of document.getElementsByClassName('shift-on')) n.hidden = !evt.shiftKey;
    for (let n of document.getElementsByClassName('shift-off')) n.hidden = evt.shiftKey;
}
window.addEventListener('keydown', keyboardEventListener, passive);
window.addEventListener('keyup', keyboardEventListener, passive);
keyboardEventListener({});

for (let d of document.querySelectorAll('dialog')) {
    d.addEventListener('cancel', () => d.returnValue = '', passive);
    for (let b of d.querySelectorAll('form button[type=cancel]')) {
        b.type = 'button';
        b.addEventListener('click', () => {
            d.dispatchEvent(new Event('cancel'));
            d.close();
        }, passive);
    }
}

}()