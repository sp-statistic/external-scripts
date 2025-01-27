const sheet_url = "https://docs.google.com/spreadsheets/d/1zlFnsVmjHiKrFvy4kNnnpWi4p2V2RL9RsDbnkfMhV44/edit?gid=1933509917#gid=1933509917"

function main() {
    let date  = Utilities.formatDate(new Date(Date.now() - 86400000), AdsApp.currentAccount().getTimeZone(), "yyyy-MM-dd")
    const orders = getOrders(date)
    const report = AdsApp.report(`SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, campaign.final_url_suffix   
  FROM campaign WHERE segments.date='${date}'`)
    for (let row of report.rows()){
        const check = getKey(row['campaign.final_url_suffix'])
        if (!check) continue
        const info = orders[check]||{num:0,sum:0}
        const impressions = parseInt(row['metrics.impressions'])
        const clicks = parseInt(row['metrics.clicks'])
        const cost = costMicros(row['metrics.cost_micros'])
        const ctr = impressions==0?0:clicks/impressions
        const cpc = clicks==0?0:cost/clicks
        const cpm = impressions==0?0:cost*1000/impressions
        const cpl = info.num==0?0:cost/info.num
        addLine([date,`'${AdsApp.currentAccount().getCustomerId()}`,`${AdsApp.currentAccount().getName()}`, `'${row['campaign.id']}`, `${row['campaign.name']}`,
            impressions,clicks,cost,ctr,cpc,cpm,cpl,info.num,info.sum])
    }

    const costReport = AdsApp.report(`SELECT  metrics.cost_micros  
  FROM customer WHERE segments.date='${date}'`)
    let sum = 0
    for (let row of costReport.rows()){
        sum = costMicros(row['metrics.cost_micros'])
    }
    updateSpend(sum)
}

function getOrders(date) {
    const sh = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("«аказы")
    const arr = sh.getDataRange().getDisplayValues()
    let obj = {}
    arr.shift()
    for (let [id,price,source,medium,campaign,sent] of arr){
        if (sent.split(" ")[0]!=date) continue
        let cur = obj[`${source}${medium}${campaign}`]||{num:0, sum:0}
        cur.sum += parseFloat(price)
        cur.num ++
        obj[`${source}${medium}${campaign}`] = cur
    }
    return obj
}

function addLine(row){
    const sh = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("Complex")
    sh.appendRow(row)
}

function costMicros(cost) {
    return parseInt(cost || 0) / 1000000
}


function getKey(suffix){
    if (!suffix) return null
    let obj = {}
    for (let parts of suffix.split("&")){
        let part = parts.split("=")
        obj[part[0]] = part[1]
    }
    return `${obj['utm_source']}${obj['utm_medium']}${obj['utm_campaign']}`

}

function updateSpend(sum){
    const sh = SpreadsheetApp.openByUrl(sheet_url).getSheetByName("“раты")
    const arr = sh.getDataRange().getDisplayValues()
    let check = true
    for (let i=1;i<arr.length;i++){
        if(arr[i][0]==AdsApp.currentAccount().getCustomerId()){
            sh.getRange(i+1,4,1,1).setValue(sum)
            check=false
        }
    }
    if(check)
        sh.appendRow([AdsApp.currentAccount().getCustomerId(),AdsApp.currentAccount().getName(),"",sum])
}
