import axios from 'axios'
import cheerio from 'cheerio'
import json2csv from 'json2csv'
import * as fsp from 'fs/promises'

const BASE_URL = "https://riskofrain2.fandom.com"

function formatIconUrl(url: string) {
    return url.replace(/\/revision(.+)/g, '');
}

async function getCharacters() {
    const response = await axios.get(`${BASE_URL}/Survivors`)
    const $ = cheerio.load(response.data)

    const tbody = $('table.wikitable tbody')

    const charactersInfoRaw: String[] = []
    tbody.children().next().each((index, element) => {
        if (element) {
            const title = $(element).find('a').text().trim()
            const icon = $(element).find('img').attr('data-src') as string
            const health = $(element).children('td:nth-child(3)').text().trim()
            const damage = $(element).children('td:nth-child(4)').text().trim()
            const healthRegen = $(element).children('td:nth-child(5)').text().trim()
            const classType = $(element).children('td:nth-child(6)').text().trim()
            const armor = $(element).children('td:nth-child(7)').text().trim()
            const movementSpeed = $(element).children('td:nth-child(8)').text().trim()
            const mass = $(element).children('td:nth-child(9)').text().trim()
            
            console.info(`Successfully got ${title} character!`);
            charactersInfoRaw.push({
                title,
                icon: formatIconUrl(icon),
                health,
                damage,
                healthRegen,
                classType,
                armor,
                movementSpeed,
                mass
            })
        }
    })

    return charactersInfoRaw
}

async function getItemsLinks() {
    const response = await axios.get(`${BASE_URL}/wiki/Items`);
    
    const $ = cheerio.load(response.data)
    const table = $('div.thumb.tright.thumbinner > table > tbody');

    const itemsLinks: String[] = []
    table
        .find('tr')
        .find('td')
        .find('span')
        .find('span')
        .find('a')
        .each((idx, ref) => {
            const elem = $(ref)
            itemsLinks.push(elem.attr().href)
        })
        
    return itemsLinks
}

async function getItemInfo(resource: string) {
    const response = await axios.get(`${BASE_URL}${resource}`);
    
    const $ = cheerio.load(response.data)
    
    const itemTitle = $('h1#firstHeading').text().trim().replace('\n', '');
    
    let itemIcon = $('table.infoboxtable').find(`img[alt="${itemTitle}.png"]`).first().attr('data-src');
    let formattedItemIcon = ''
    if (!itemIcon) {
        itemIcon = $('table.infoboxtable').find(`img[alt="${itemTitle}.png"]`).first().attr().src;
    }
    formattedItemIcon = formatIconUrl(itemIcon)

    const itemDescription = $('td').filter(function() {
        return $(this).text().trim() === 'Rarity';
    }).parent().prev().children().text().trim();

    const itemRarity = $('td').filter(function() {
        return $(this).text().trim() === 'Rarity';
    }).next().text().replace('\n', '');
    
    const itemCategory = $('td').filter(function() {
        return $(this).text().trim() === 'Category';
    }).next().text().replace('\n', '');

    const itemStatsRaw: String[] = []
    const itemStatsElements = $('th').filter(function() {
        return $(this).text().trim() === 'Stat'
    }).parent().nextAll().each((idx, elem) => {
        itemStatsRaw.push($(elem).text().trim())
    })

    const sanitizedItemStats = itemStatsRaw.map(stat => {
        const splittedStats = stat.split('\n\n')
        const stats = {
            stat: splittedStats[0],
            value: splittedStats[1],
            stack: splittedStats[2],
            add: splittedStats[3],
        }
        return stats
    })

    const item = {
        title: itemTitle,
        description: itemDescription,
        icon: formattedItemIcon,
        category: itemCategory,
        rarity: itemRarity,
        stats: sanitizedItemStats
    }

    console.info(`Successfully got ${item.title} item!`);
    return item
}

async function saveCsv(data: any[], filename) {
    console.info(`Creating CSV...`);
    const j2cp = new json2csv.Parser();
    const csv = j2cp.parse(data);

    await fsp.writeFile(`./${filename}.csv`, csv, { encoding: "utf-8" })
    await fsp.writeFile(`./${filename}.json`, JSON.stringify(data, null, 2), { encoding: "utf-8" })
}

(async () => {
    const characters = await getCharacters();
    const itemsLinks = await getItemsLinks();
    const itemsList: any[] = []

    for (let resource of itemsLinks) {
        const item = await getItemInfo(resource)
        itemsList.push(item)
    }

    await saveCsv(itemsList, 'items')
    await saveCsv(characters, 'characters')
})();