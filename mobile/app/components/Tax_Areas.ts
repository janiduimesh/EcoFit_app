// src/constants/locations.ts

export interface LocationItem {
  label: string;
  value: string;
  district: 'Colombo' | 'Gampaha';
}

export const REGIONAL_LOCATIONS: LocationItem[] = [
  // --- COLOMBO DISTRICT ---
  { label: "Malabe", value: "Malabe", district: "Colombo" },
  { label: "Battaramulla", value: "Battaramulla", district: "Colombo" },
  { label: "Nugegoda", value: "Nugegoda", district: "Colombo" },
  { label: "Maharagama", value: "Maharagama", district: "Colombo" },
  { label: "Piliyandala", value: "Piliyandala", district: "Colombo" },
  { label: "Kottawa", value: "Kottawa", district: "Colombo" },
  { label: "Pannipitiya", value: "Pannipitiya", district: "Colombo" },
  { label: "Homagama", value: "Homagama", district: "Colombo" },
  { label: "Dehiwala", value: "Dehiwala", district: "Colombo" },
  { label: "Mount Lavinia", value: "Mount_Lavinia", district: "Colombo" },
  { label: "Moratuwa", value: "Moratuwa", district: "Colombo" },
  { label: "Ratmalana", value: "Ratmalana", district: "Colombo" },
  { label: "Rajagiriya", value: "Rajagiriya", district: "Colombo" },
  { label: "Kotte", value: "Kotte", district: "Colombo" },
  { label: "Kaduwela", value: "Kaduwela", district: "Colombo" },
  { label: "Athurugiriya", value: "Athurugiriya", district: "Colombo" },
  { label: "Boralesgamuwa", value: "Boralesgamuwa", district: "Colombo" },
  { label: "Kesbewa", value: "Kesbewa", district: "Colombo" },
  { label: "Wellampitiya", value: "Wellampitiya", district: "Colombo" },
  { label: "Kolonnawa", value: "Kolonnawa", district: "Colombo" },
  { label: "Hanwella", value: "Hanwella", district: "Colombo" },
  { label: "Padukka", value: "Padukka", district: "Colombo" },
  { label: "Avissawella", value: "Avissawella", district: "Colombo" },
  { label: "Talawatugoda", value: "Talawatugoda", district: "Colombo" },
  { label: "Kohuwala", value: "Kohuwala", district: "Colombo" },

  // --- GAMPAHA DISTRICT ---
  { label: "Gampaha City", value: "Gampaha", district: "Gampaha" },
  { label: "Negombo", value: "Negombo", district: "Gampaha" },
  { label: "Kiribathgoda", value: "Kiribathgoda", district: "Gampaha" },
  { label: "Kadawatha", value: "Kadawatha", district: "Gampaha" },
  { label: "Wattala", value: "Wattala", district: "Gampaha" },
  { label: "Ja-Ela", value: "Ja_Ela", district: "Gampaha" },
  { label: "Kandana", value: "Kandana", district: "Gampaha" },
  { label: "Ragama", value: "Ragama", district: "Gampaha" },
  { label: "Kelaniya", value: "Kelaniya", district: "Gampaha" },
  { label: "Peliyagoda", value: "Peliyagoda", district: "Gampaha" },
  { label: "Minuwangoda", value: "Minuwangoda", district: "Gampaha" },
  { label: "Veyangoda", value: "Veyangoda", district: "Gampaha" },
  { label: "Nittambuwa", value: "Nittambuwa", district: "Gampaha" },
  { label: "Mirigama", value: "Mirigama", district: "Gampaha" },
  { label: "Delgoda", value: "Delgoda", district: "Gampaha" },
  { label: "Biyagama", value: "Biyagama", district: "Gampaha" },
  { label: "Sapugaskanda", value: "Sapugaskanda", district: "Gampaha" },
  { label: "Katunayake", value: "Katunayake", district: "Gampaha" },
  { label: "Seeduwa", value: "Seeduwa", district: "Gampaha" },
  { label: "Ganemulla", value: "Ganemulla", district: "Gampaha" },
  { label: "Yakkala", value: "Yakkala", district: "Gampaha" }
];