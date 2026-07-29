import { asc } from './asc-api.mjs';

const APP_INFO_ID = '7d9c7d47-c7b0-4cf7-b126-ec951b896445';

// Factual declaration for Brawl Arena: a cartoon/arcade fighting game.
// Fighting is the constant, core gameplay loop (not occasional) -> FREQUENT
// cartoon/fantasy violence. No blood/gore, no realistic weapons (melee +
// thrown props only), no chat/UGC/gambling/mature content. Shows real ads
// (AdMob) and sells fixed-price IAPs (not randomized loot boxes).
const attributes = {
  violenceCartoonOrFantasy: 'FREQUENT',
  violenceRealistic: 'NONE',
  violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  alcoholTobaccoOrDrugUseOrReferences: 'NONE',
  contests: 'NONE',
  gamblingSimulated: 'NONE',
  gunsOrOtherWeapons: 'NONE',
  horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE',
  medicalOrTreatmentInformation: 'NONE',
  profanityOrCrudeHumor: 'NONE',
  sexualContentGraphicAndNudity: 'NONE',
  sexualContentOrNudity: 'NONE',
  advertising: true,
  ageAssurance: false,
  gambling: false,
  healthOrWellnessTopics: false,
  lootBox: false,
  messagingAndChat: false,
  parentalControls: false,
  unrestrictedWebAccess: false,
  userGeneratedContent: false,
};

const current = await asc('GET', `/v1/appInfos/${APP_INFO_ID}/ageRatingDeclaration`);
const id = current.data.id;
console.log('resource id:', id, 'type:', current.data.type);

try {
  const result = await asc('PATCH', `/v1/ageRatingDeclarations/${id}`, {
    data: { type: 'ageRatingDeclarations', id, attributes },
  });
  console.log('OK', JSON.stringify(result.data.attributes, null, 2));
} catch (e) {
  console.log('FAIL', e.status, JSON.stringify(e.body, null, 2));
}
