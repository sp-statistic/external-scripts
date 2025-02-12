const WEBHOOK_URL = "https://smallprice.date/api/webhook/google";

function main() {
    let date = Utilities.formatDate(new Date(Date.now() - 86400000), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
    const report = AdsApp.report(`SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, campaign.final_url_suffix FROM campaign WHERE segments.date='${date}'`);

    let campaignData = [];
    let totalCost = 0;

    for (let row of report.rows()) {
        const check = getKey(row['campaign.final_url_suffix']);
        if (!check) continue;

        const impressions = parseInt(row['metrics.impressions']);
        const clicks = parseInt(row['metrics.clicks']);
        const cost = costMicros(row['metrics.cost_micros']);
        const ctr = impressions == 0 ? 0 : clicks / impressions;
        const cpc = clicks == 0 ? 0 : cost / clicks;
        const cpm = impressions == 0 ? 0 : cost * 1000 / impressions;
        const cpl = cost / (clicks == 0 ? 1 : clicks); // Защита от деления на 0

        campaignData.push({
            date: date,
            customer_id: AdsApp.currentAccount().getCustomerId(),
            customer_name: AdsApp.currentAccount().getName(),
            campaign_id: row['campaign.id'],
            campaign_name: row['campaign.name'],
            impressions: impressions,
            clicks: clicks,
            cost: cost,
            ctr: ctr,
            cpc: cpc,
            cpm: cpm,
            cpl: cpl
        });
    }

    const costReport = AdsApp.report(`SELECT metrics.cost_micros FROM customer WHERE segments.date='${date}'`);
    for (let row of costReport.rows()) {
        totalCost = costMicros(row['metrics.cost_micros']);
    }

    const payload = {
        campaign_data: campaignData,
        total_spend: totalCost
    };

    sendToWebhook(payload);
}

function sendToWebhook(data) {
    const options = {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify(data)
    };
    UrlFetchApp.fetch(WEBHOOK_URL, options);
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
