// Approximate district headquarters (fallback markers when no boundary file is supplied).
// `fp` / `r` describe an approximate circular footprint (km) used to rasterise the district
// for warnings when /public/geo/districts/<id>.geojson is missing. None of this is survey-grade.

export interface DistrictHQ {
  id: string
  name: string
  hi: string
  state: string
  hq: string
  lat: number
  lon: number
  /** footprint centre if the HQ sits at the district edge */
  fp?: [number, number]
  /** approximate footprint radius, km */
  r: number
}

const d = (
  id: string,
  name: string,
  hi: string,
  state: string,
  hq: string,
  lat: number,
  lon: number,
  r: number,
  fp?: [number, number],
): DistrictHQ => ({ id, name, hi, state, hq, lat, lon, r, fp })

const LIST: DistrictHQ[] = [
  // Odisha
  d('khordha', 'Khordha', 'खोर्धा', 'Odisha', 'Khordha', 20.18, 85.62, 30),
  d('cuttack', 'Cuttack', 'कटक', 'Odisha', 'Cuttack', 20.46, 85.88, 30),
  d('puri', 'Puri', 'पुरी', 'Odisha', 'Puri', 19.81, 85.83, 30),
  d('jagatsinghpur', 'Jagatsinghpur', 'जगतसिंहपुर', 'Odisha', 'Jagatsinghpur', 20.26, 86.17, 20),
  d('kendrapara', 'Kendrapara', 'केंद्रपाड़ा', 'Odisha', 'Kendrapara', 20.5, 86.42, 25),
  d('jajpur', 'Jajpur', 'जाजपुर', 'Odisha', 'Jajpur', 20.85, 86.33, 28),
  d('ganjam', 'Ganjam', 'गंजाम', 'Odisha', 'Chhatrapur', 19.35, 84.98, 40, [19.55, 84.75]),
  d('gajapati', 'Gajapati', 'गजपति', 'Odisha', 'Paralakhemundi', 18.78, 84.09, 30, [19.0, 84.15]),
  d('nayagarh', 'Nayagarh', 'नयागढ़', 'Odisha', 'Nayagarh', 20.13, 85.1, 28),
  // West Bengal
  d('kolkata', 'Kolkata', 'कोलकाता', 'West Bengal', 'Kolkata', 22.57, 88.36, 8),
  d('howrah', 'Howrah', 'हावड़ा', 'West Bengal', 'Howrah', 22.59, 88.31, 15, [22.55, 88.15]),
  d('hooghly', 'Hooghly', 'हुगली', 'West Bengal', 'Chinsurah', 22.9, 88.39, 22, [22.9, 88.2]),
  d('north-24-parganas', 'North 24 Parganas', 'उत्तर 24 परगना', 'West Bengal', 'Barasat', 22.72, 88.48, 25, [22.75, 88.65]),
  d('south-24-parganas', 'South 24 Parganas', 'दक्षिण 24 परगना', 'West Bengal', 'Alipore', 22.53, 88.33, 35, [22.15, 88.45]),
  // Bihar
  d('gaya', 'Gaya', 'गया', 'Bihar', 'Gaya', 24.79, 85.0, 35),
  d('aurangabad-bihar', 'Aurangabad', 'औरंगाबाद', 'Bihar', 'Aurangabad', 24.75, 84.37, 28),
  d('jehanabad', 'Jehanabad', 'जहानाबाद', 'Bihar', 'Jehanabad', 25.21, 84.99, 15),
  d('nawada', 'Nawada', 'नवादा', 'Bihar', 'Nawada', 24.89, 85.54, 28),
  d('arwal', 'Arwal', 'अरवल', 'Bihar', 'Arwal', 25.25, 84.68, 12),
  // Jharkhand
  d('ranchi', 'Ranchi', 'राँची', 'Jharkhand', 'Ranchi', 23.34, 85.31, 35),
  d('khunti', 'Khunti', 'खूँटी', 'Jharkhand', 'Khunti', 23.07, 85.28, 25),
  d('gumla', 'Gumla', 'गुमला', 'Jharkhand', 'Gumla', 23.04, 84.54, 35),
  d('lohardaga', 'Lohardaga', 'लोहरदगा', 'Jharkhand', 'Lohardaga', 23.43, 84.68, 20),
  // Maharashtra (Mumbai region)
  d('mumbai-city', 'Mumbai City', 'मुंबई शहर', 'Maharashtra', 'Mumbai', 18.96, 72.82, 6),
  d('mumbai-suburban', 'Mumbai Suburban', 'मुंबई उपनगर', 'Maharashtra', 'Bandra', 19.06, 72.84, 10, [19.12, 72.88]),
  d('thane', 'Thane', 'ठाणे', 'Maharashtra', 'Thane', 19.2, 72.97, 30, [19.3, 73.2]),
  d('raigad', 'Raigad', 'रायगढ़', 'Maharashtra', 'Alibag', 18.64, 72.87, 35, [18.5, 73.15]),
  d('palghar', 'Palghar', 'पालघर', 'Maharashtra', 'Palghar', 19.7, 72.77, 30, [19.85, 72.98]),
  // Delhi NCR
  d('new-delhi', 'New Delhi', 'नई दिल्ली', 'Delhi', 'New Delhi', 28.61, 77.21, 8),
  d('gurugram', 'Gurugram', 'गुरुग्राम', 'Haryana', 'Gurugram', 28.46, 77.03, 20),
  d('faridabad', 'Faridabad', 'फ़रीदाबाद', 'Haryana', 'Faridabad', 28.41, 77.32, 15),
  d('gautam-buddha-nagar', 'Gautam Buddha Nagar', 'गौतम बुद्ध नगर', 'Uttar Pradesh', 'Greater Noida', 28.47, 77.5, 18),
  d('ghaziabad', 'Ghaziabad', 'ग़ाज़ियाबाद', 'Uttar Pradesh', 'Ghaziabad', 28.67, 77.44, 18),
  // Kerala
  d('ernakulam', 'Ernakulam', 'एर्नाकुलम', 'Kerala', 'Kakkanad', 10.01, 76.34, 25),
  d('idukki', 'Idukki', 'इडुक्की', 'Kerala', 'Painavu', 9.85, 76.94, 35),
  d('kottayam', 'Kottayam', 'कोट्टयम', 'Kerala', 'Kottayam', 9.59, 76.52, 25),
  d('alappuzha', 'Alappuzha', 'आलप्पुझा', 'Kerala', 'Alappuzha', 9.5, 76.34, 22),
  d('thrissur', 'Thrissur', 'त्रिशूर', 'Kerala', 'Thrissur', 10.52, 76.21, 28),
  // Assam
  d('kamrup-metropolitan', 'Kamrup Metropolitan', 'कामरूप महानगर', 'Assam', 'Guwahati', 26.14, 91.74, 15),
  d('kamrup', 'Kamrup', 'कामरूप', 'Assam', 'Amingaon', 26.19, 91.67, 30, [26.2, 91.4]),
  d('nalbari', 'Nalbari', 'नलबाड़ी', 'Assam', 'Nalbari', 26.44, 91.44, 18),
  d('darrang', 'Darrang', 'दरांग', 'Assam', 'Mangaldai', 26.44, 92.03, 22),
  d('morigaon', 'Morigaon', 'मोरीगाँव', 'Assam', 'Morigaon', 26.25, 92.34, 22),
  // Telangana
  d('hyderabad', 'Hyderabad', 'हैदराबाद', 'Telangana', 'Hyderabad', 17.39, 78.47, 10),
  d('ranga-reddy', 'Ranga Reddy', 'रंगारेड्डी', 'Telangana', 'Kongara Kalan', 17.24, 78.55, 30, [17.25, 78.3]),
  d('medchal-malkajgiri', 'Medchal–Malkajgiri', 'मेडचल–मलकाजगिरी', 'Telangana', 'Medchal', 17.63, 78.48, 18, [17.55, 78.55]),
  d('sangareddy', 'Sangareddy', 'संगारेड्डी', 'Telangana', 'Sangareddy', 17.62, 78.09, 30, [17.7, 77.9]),
  // Central India
  d('balaghat', 'Balaghat', 'बालाघाट', 'Madhya Pradesh', 'Balaghat', 21.81, 80.19, 35),
  d('seoni', 'Seoni', 'सिवनी', 'Madhya Pradesh', 'Seoni', 22.09, 79.54, 35),
  d('mandla', 'Mandla', 'मंडला', 'Madhya Pradesh', 'Mandla', 22.6, 80.37, 35),
  d('gondia', 'Gondia', 'गोंदिया', 'Maharashtra', 'Gondia', 21.46, 80.19, 28),
  d('bhandara', 'Bhandara', 'भंडारा', 'Maharashtra', 'Bhandara', 21.17, 79.65, 25),
  // Punjab
  d('sangrur', 'Sangrur', 'संगरूर', 'Punjab', 'Sangrur', 30.25, 75.84, 28),
  d('barnala', 'Barnala', 'बरनाला', 'Punjab', 'Barnala', 30.38, 75.55, 18),
  d('mansa', 'Mansa', 'मानसा', 'Punjab', 'Mansa', 29.99, 75.39, 25),
  d('bathinda', 'Bathinda', 'बठिंडा', 'Punjab', 'Bathinda', 30.21, 74.95, 30),
  d('patiala', 'Patiala', 'पटियाला', 'Punjab', 'Patiala', 30.34, 76.39, 30),
  // Uncommon-region scenarios
  d('jodhpur', 'Jodhpur', 'जोधपुर', 'Rajasthan', 'Jodhpur', 26.24, 73.02, 50),
  d('nagaur', 'Nagaur', 'नागौर', 'Rajasthan', 'Nagaur', 27.2, 73.73, 50),
  d('pali', 'Pali', 'पाली', 'Rajasthan', 'Pali', 25.77, 73.32, 45),
  d('anantapur', 'Anantapur', 'अनंतपुर', 'Andhra Pradesh', 'Anantapuramu', 14.68, 77.6, 40),
  d('sri-sathya-sai', 'Sri Sathya Sai', 'श्री सत्य साई', 'Andhra Pradesh', 'Puttaparthi', 14.17, 77.81, 35),
  d('kurnool', 'Kurnool', 'कुर्नूल', 'Andhra Pradesh', 'Kurnool', 15.83, 78.04, 42),
  d('jhunjhunu', 'Jhunjhunu', 'झुंझुनूं', 'Rajasthan', 'Jhunjhunu', 28.13, 75.4, 30),
  d('sikar', 'Sikar', 'सीकर', 'Rajasthan', 'Sikar', 27.61, 75.14, 35),
  d('churu', 'Churu', 'चूरू', 'Rajasthan', 'Churu', 28.3, 74.95, 42),
]

export const DISTRICTS: Record<string, DistrictHQ> = Object.fromEntries(LIST.map((x) => [x.id, x]))

export function footprintCentre(dq: DistrictHQ): [number, number] {
  return dq.fp ?? [dq.lat, dq.lon]
}
