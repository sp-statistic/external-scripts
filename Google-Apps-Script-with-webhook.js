const WEBHOOK_URL = "https://smallprice.date/api/webhook/google";

function main() {
    let date = Utilities.formatDate(new Date(Date.now() - 86400000), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
    const orders = getOrders(date);
    const report = AdsApp.report(`SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, campaign.final_url_suffix   
  FROM campaign WHERE segments.date='${date}'`);

    let payload = []; // Массив для хранения данных, которые будут отправлены на вебхук

    for (let row of report.rows()) {
        const check = getKey(row['campaign.final_url_suffix']);
        if (!check) continue;

        const info = orders[check] || { num: 0, sum: 0 };
        const impressions = parseInt(row['metrics.impressions']);
        const clicks = parseInt(row['metrics.clicks']);
        const cost = costMicros(row['metrics.cost_micros']);
        const ctr = impressions === 0 ? 0 : clicks / impressions;
        const cpc = clicks === 0 ? 0 : cost / clicks;
        const cpm = impressions === 0 ? 0 : (cost * 1000) / impressions;
        const cpl = info.num === 0 ? 0 : cost / info.num;

        // Формируем объект с данными
        const data = {
            date: date,
            customerId: AdsApp.currentAccount().getCustomerId(),
            accountName: AdsApp.currentAccount().getName(),
            campaignId: row['campaign.id'],
            campaignName: row['campaign.name'],
            impressions: impressions,
            clicks: clicks,
            cost: cost,
            ctr: ctr,
            cpc: cpc,
            cpm: cpm,
            cpl: cpl,
            ordersNum: info.num,
            ordersSum: info.sum
        };

        payload.push(data); // Добавляем данные в массив
    }

    // Отправляем данные на вебхук
    sendToWebhook(payload);

    // Обновляем затраты (если нужно)
    const costReport = AdsApp.report(`SELECT metrics.cost_micros FROM customer WHERE segments.date='${date}'`);
    let sum = 0;
    for (let row of costReport.rows()) {
        sum = costMicros(row['metrics.cost_micros']);
    }

    // Отправляем данные о затратах на вебхук
    const spendData = {
        customerId: AdsApp.currentAccount().getCustomerId(),
        accountName: AdsApp.currentAccount().getName(),
        totalSpend: sum
    };
    sendToWebhook([spendData]);
}

function getOrders(date) {
    const sh = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("«аказы");
    const arr = sh.getDataRange().getDisplayValues();
    let obj = {};
    arr.shift();
    for (let [id, price, source, medium, campaign, sent] of arr) {
        if (sent.split(" ")[0] !== date) continue;
        let cur = obj[`${source}${medium}${campaign}`] || { num: 0, sum: 0 };
        cur.sum += parseFloat(price);
        cur.num++;
        obj[`${source}${medium}${campaign}`] = cur;
    }
    return obj;
}

function costMicros(cost) {
    return parseInt(cost || 0) / 1000000;
}

function getKey(suffix) {
    if (!suffix) return null;
    let obj = {};
    for (let parts of suffix.split("&")) {
        let part = parts.split("=");
        obj[part[0]] = part[1];
    }
    return `${obj['utm_source']}${obj['utm_medium']}${obj['utm_campaign']}`;
}

function sendToWebhook(data) {
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(data),
        muteHttpExceptions: true // Чтобы видеть ошибки, если они возникнут
    };

    try {
        const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
        Logger.log("Webhook response: " + response.getContentText());

        if (response.getResponseCode() !== 200) {
            Logger.log("Failed to send data: " + response.getContentText());
        }
    } catch (e) {
        Logger.log("Error sending data to webhook: " + e.toString());
    }
}
