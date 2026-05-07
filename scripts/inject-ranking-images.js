// Script: inject image: fields into rankings.ts
// Usage: node scripts/inject-ranking-images.js

const fs = require('fs')
const path = require('path')

const IMAGE_MAP = {
  // Fútbol masculino
  dembele:   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg/330px-Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg',
  yamal:     'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Lamine_Yamal_in_2025.jpg/330px-Lamine_Yamal_in_2025.jpg',
  mbappe:    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg/330px-Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg',
  salah:     'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Mohamed_Salah_2018.jpg/330px-Mohamed_Salah_2018.jpg',
  vitinha:   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Vitinha_USMNT_v_Portugal_Mar_31_2026-50.jpg/330px-Vitinha_USMNT_v_Portugal_Mar_31_2026-50.jpg',
  hakimi:    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Achraf_Hakimi_%28cropped%29.jpg/330px-Achraf_Hakimi_%28cropped%29.jpg',
  haaland:   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Erling_Haaland_June_2025.jpg/330px-Erling_Haaland_June_2025.jpg',
  bellingham:'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg/330px-25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg',
  wirtz:     'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg/330px-Florian_Wirtz%2C_2022-07-31%2C_Saisoner%C3%B6ffnung_Bayer_04%2C_Leverkusen_%281%29_%28cropped%29.jpg',
  doue:      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Doue_asse_psg_2425.png/330px-Doue_asse_psg_2425.png',
  kvara:     'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Kvaratskhelia_asse_psg_2425.png/330px-Kvaratskhelia_asse_psg_2425.png',
  saka:      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/1_bukayo_saka_arsenal_2025_%28cropped%29.jpg/330px-1_bukayo_saka_arsenal_2025_%28cropped%29.jpg',
  pedri:     'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Pedri.jpg/330px-Pedri.jpg',
  rodri:     'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg/330px-RODRI_-_SWE_vs_ESP_-_UEFA_EURO_2020_QUALIFIERS_-_2019.10.15_%28cropped%29.jpg',
  vinicius:  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg/330px-2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg',
  messi:     'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg/330px-Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg',
  foden:     'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2613%2C_Phil_Foden.jpg/330px-2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2613%2C_Phil_Foden.jpg',
  lautaro:   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg/330px-Lautaro_Martinez_ARGENTINA_VS_VENEZUELA_2017.jpg',
  leao:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/RafaelLe%C3%A3oPortugal23.jpg/330px-RafaelLe%C3%A3oPortugal23.jpg',
  'jhon-duran': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Jhon_Dur%C3%A1n%2C_Esteghlal_FC_vs_Al-Nassr_FC_%28ACLElite%29%3B_3_Mar_2025.png/330px-Jhon_Dur%C3%A1n%2C_Esteghlal_FC_vs_Al-Nassr_FC_%28ACLElite%29%3B_3_Mar_2025.png',
  enzo:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Enzo_Fern%C3%A1ndez_2025_FIFA_Club_World_Cup_Final.jpg/330px-Enzo_Fern%C3%A1ndez_2025_FIFA_Club_World_Cup_Final.jpg',
  palmer:    'https://upload.wikimedia.org/wikipedia/commons/f/fb/Cole_Palmer_2025_FIFA_Club_World_Cup_Final.jpg',
  rodrygo:   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Rodrygo_2023_%28cropped%29.jpg/330px-Rodrygo_2023_%28cropped%29.jpg',
  alisson:   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg/330px-20180610_FIFA_Friendly_Match_Austria_vs._Brazil_850_1625.jpg',
  endrick:   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Endrick-Palmeiras-Liverpool-abr24.jpg/330px-Endrick-Palmeiras-Liverpool-abr24.jpg',
  estevao:   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Estevao-Palmeiras-Liverpool-abr24_%28cropped%29.jpg/330px-Estevao-Palmeiras-Liverpool-abr24_%28cropped%29.jpg',
  pulisic:   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Christian_Pulisic_USMNT_v_Belgium_Mar_28_2026-73_%28cropped%29.jpg/330px-Christian_Pulisic_USMNT_v_Belgium_Mar_28_2026-73_%28cropped%29.jpg',
  // NBA
  sga:       'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png/330px-Shai_Gilgeous-Alexander_-_Thunder_vs._Wizards.png',
  jokic:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Nikola_Jokic_free_throw_%28cropped%29.jpg/330px-Nikola_Jokic_free_throw_%28cropped%29.jpg',
  wemba:     'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Victor_Wembanyama_San_Antonio_Spurs_2024.jpg/330px-Victor_Wembanyama_San_Antonio_Spurs_2024.jpg',
  tatum:     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg/330px-Celtics_at_Wizards_2024-12-044_%28cropped_2%29.jpg',
  doncic:    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg/330px-Luka_Doncic_%2851914951721%29_%28cropped1%29.jpg',
  lebron:    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg/330px-LeBron_James_%2851959977144%29_%28cropped2%29.jpg',
  giannis:   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Giannis_Antetokounmpo_%2851915153421%29_%28cropped%29.jpg/330px-Giannis_Antetokounmpo_%2851915153421%29_%28cropped%29.jpg',
  // Tenis
  sinner:    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Jannik_Sinner_2025_US_Open.jpg/330px-Jannik_Sinner_2025_US_Open.jpg',
  alcaraz:   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Carlos_Alcaraz_2025_FO.jpg/330px-Carlos_Alcaraz_2025_FO.jpg',
  sabalenka: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Aryna_Sabalenka_Miami_Open_Final.jpg/330px-Aryna_Sabalenka_Miami_Open_Final.jpg',
  rybakina:  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Elena_Rybakina_%282025_DC_Open%29_11_%28cropped%29.jpg/330px-Elena_Rybakina_%282025_DC_Open%29_11_%28cropped%29.jpg',
  gauff:     'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Coco_Gauff_Miami_Open.jpg/330px-Coco_Gauff_Miami_Open.jpg',
  djokovic:  'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Novak_Djokovic_2024_Paris_Olympics.jpg/330px-Novak_Djokovic_2024_Paris_Olympics.jpg',
  swiatek:   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Iga_Swiatek_2023_Cropped_%2B_Retouched.jpg/330px-Iga_Swiatek_2023_Cropped_%2B_Retouched.jpg',
  // F1
  norris:    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3968_by_Stepro_%28cropped2%29.jpg',
  verstappen:'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3973_by_Stepro_%28medium_crop%29.jpg',
  antonelli: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg/330px-Kimi_Antonelli_at_the_2025_US_Grand_Prix_in_Austin%2C_TX_%28cropped%29.jpg',
  piastri:   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg/330px-2026_Chinese_GP_-_Oscar_Piastri_%28cropped%29_%28cropped%29.jpg',
  leclerc:   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3978_by_Stepro_%28cropped2%29.jpg/330px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3978_by_Stepro_%28cropped2%29.jpg',
  // UFC
  aspinall:  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Tom_Aspinall_UFC_295_%28cropped%29.jpg/330px-Tom_Aspinall_UFC_295_%28cropped%29.jpg',
  topuria:   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ilia_Topuria_at_the_Orbeliani_Palace_%28cropped%29.jpg/330px-Ilia_Topuria_at_the_Orbeliani_Palace_%28cropped%29.jpg',
  pereira:   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Alex_Pereira_UFC_300.png/330px-Alex_Pereira_UFC_300.png',
  mcgregor:  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Conor_McGregor_2025.jpeg/330px-Conor_McGregor_2025.jpeg',
  makhachev: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Islam_Makhachev_2022_UFC_belt_%28cropped%29.png/330px-Islam_Makhachev_2022_UFC_belt_%28cropped%29.png',
  chimaev:   'https://upload.wikimedia.org/wikipedia/commons/b/b3/Khamzat_Chimaev_2022_%28cropped%29.png',
  // Golf
  rory:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Rory_McIlroy_Ryder_Cup_2025-195_%28cropped%29.jpg/330px-Rory_McIlroy_Ryder_Cup_2025-195_%28cropped%29.jpg',
  // WWE
  reigns:        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Roman_Reigns_RR25_%281%29_%28headshot%29.jpg/330px-Roman_Reigns_RR25_%281%29_%28headshot%29.jpg',
  'cody-rhodes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Cody_Rhodes_Fort_Bragg_Army_250_Birthday_Celebration_%28headshot%29.jpg/330px-Cody_Rhodes_Fort_Bragg_Army_250_Birthday_Celebration_%28headshot%29.jpg',
  'rhea-ripley': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Rhea_Ripley_040724_%28cropped%29.jpg/330px-Rhea_Ripley_040724_%28cropped%29.jpg',
  rollins:       'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Seth_Rollins_July_2019.jpg/330px-Seth_Rollins_July_2019.jpg',
  punk:          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/CM_Punk_WWE_2024_%28close_crop%29.png/330px-CM_Punk_WWE_2024_%28close_crop%29.png',
  gunther:       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Gunther_August_2024_%28headshot%29.jpg/330px-Gunther_August_2024_%28headshot%29.jpg',
  'jey-uso':     'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Jey_Uso_RR25_%281%29_%28cropped%29.jpg/330px-Jey_Uso_RR25_%281%29_%28cropped%29.jpg',
  'iyo-sky':     'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Iyo_Sky_042025_%28Cropped%29.jpg/330px-Iyo_Sky_042025_%28Cropped%29.jpg',
  'liv-morgan':  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Big_E%2C_Liv_Morgan_%26_Tyler_Breeze_%281%29_%28cropped_2%29.jpg/330px-Big_E%2C_Liv_Morgan_%26_Tyler_Breeze_%281%29_%28cropped_2%29.jpg',
  becky:         'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Becky_Lynch_Galaxycon.jpg/330px-Becky_Lynch_Galaxycon.jpg',
  belair:        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Bianca_Belair_042025_%28cropped%29.jpg/330px-Bianca_Belair_042025_%28cropped%29.jpg',
  femi:          'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Oba_Femi_2024.jpg/330px-Oba_Femi_2024.jpg',
  'sami-zayn':   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Sami_Zayn_041826_%28cropped%29.jpg/330px-Sami_Zayn_041826_%28cropped%29.jpg',
  // Fútbol femenino
  bonmati:    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/25th_Laureus_World_Sports_Awards_-_240422_214032.jpg/330px-25th_Laureus_World_Sports_Awards_-_240422_214032.jpg',
  caldentey:  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5801_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5801_%28cropped%29.jpg',
  russo:      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05_%28cropped-J1%29.jpg/330px-Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05_%28cropped-J1%29.jpg',
  pajor:      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/2018_Women%27s_DFB-Pokal_Final_-_Ewa_Pajor_%28Wolfsburg%29_%28cropped%29.jpg/330px-2018_Women%27s_DFB-Pokal_Final_-_Ewa_Pajor_%28Wolfsburg%29_%28cropped%29.jpg',
  putellas:   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5851_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A5851_%28cropped%29.jpg',
  paralluelo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A6178_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A6178_%28cropped%29.jpg',
  hampton:    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/20250510-Hannah_Hampton_%28cropped_-_portrait%29.jpg/330px-20250510-Hannah_Hampton_%28cropped_-_portrait%29.jpg',
  hansen:     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A7081_%28cropped%29.jpg/330px-Brann_-_Bar%C3%A7a_Femen%C3%AD_CG3A7081_%28cropped%29.jpg',
  kelly:      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/On_29.07.England_Lionesses_Bus_Celebration_-_The_Mall%2C_Lond2025_11_%28cropped-J1%29.jpg/330px-On_29.07.England_Lionesses_Bus_Celebration_-_The_Mall%2C_Lond2025_11_%28cropped-J1%29.jpg',
  kerr:       'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Sam_Kerr_%28Women_World_Cup_France_2019%29.jpg/330px-Sam_Kerr_%28Women_World_Cup_France_2019%29.jpg',
}

// Regional/sub-array IDs that map to a base player image
const ID_ALIASES = {
  'yamal-sub21':      'yamal',
  'doue-sub21':       'doue',
  'wemba-sub21':      'wemba',
  'antonelli-sub21':  'antonelli',
  'alcaraz-sub21':    'alcaraz',
  'bellingham-sub21': 'bellingham',
  'wirtz-sub21':      'wirtz',
  'lautaro-latam':    'lautaro',
  'pereira-latam':    'pereira',
  'vinicius-latam':   'vinicius',
  'messi-latam':      'messi',
  'rodrygo-latam':    'rodrygo',
  'alisson-latam':    'alisson',
  'endrick-latam':    'endrick',
  'sga-cc':           'sga',
  'tatum-cc':         'tatum',
  'lebron-cc':        'lebron',
  'jokic-prev':       'tatum',  // entry mislabeled — is actually Jayson Tatum
}

function resolveImage(id) {
  if (IMAGE_MAP[id]) return IMAGE_MAP[id]
  const base = ID_ALIASES[id]
  if (base && IMAGE_MAP[base]) return IMAGE_MAP[base]
  return null
}

const filePath = path.join(__dirname, '../src/lib/rankings.ts')
const lines = fs.readFileSync(filePath, 'utf-8').split('\n')

let injected = 0
let skipped = 0
const result = []
let i = 0

while (i < lines.length) {
  const line = lines[i]

  // Detect start of an entry: line with id: 'xxx'
  const idMatch = line.match(/id:\s*'([^']+)'/)
  if (idMatch) {
    const id = idMatch[1]
    const imageUrl = resolveImage(id)

    // Collect the full entry block (until closing '  },')
    const entryLines = [line]
    let j = i + 1
    while (j < lines.length && !lines[j].match(/^\s{2}\},?\s*$/)) {
      entryLines.push(lines[j])
      j++
    }
    // Include the closing line
    if (j < lines.length) entryLines.push(lines[j])

    const entryText = entryLines.join('\n')
    const alreadyHasImage = /\bimage:\s*'/.test(entryText)

    if (imageUrl && !alreadyHasImage) {
      // Find the emoji: line index within entryLines
      const emojiLineIdx = entryLines.findIndex(l => /emoji:\s*'/.test(l))
      if (emojiLineIdx !== -1) {
        // Insert image: line after the emoji: line, matching same indentation
        const indent = entryLines[emojiLineIdx].match(/^(\s*)/)[1]
        const insertLine = `${indent}image: '${imageUrl}',`
        entryLines.splice(emojiLineIdx + 1, 0, insertLine)
        injected++
      }
    } else if (alreadyHasImage) {
      skipped++
    }

    result.push(...entryLines)
    i = j + 1
    continue
  }

  result.push(line)
  i++
}

fs.writeFileSync(filePath, result.join('\n'), 'utf-8')
console.log(`✓ Injected ${injected} image fields. Skipped ${skipped} (already set or no image found).`)
