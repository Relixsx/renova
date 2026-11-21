# Selligate delivery areas for Renova

The owner supplied 34 delivery locations. They map to 28 states and the Federal Capital Territory, with more than one hub in Abia, Akwa Ibom, Anambra and Delta.

This is the Renova automation list, not a guarantee from Selligate for every ward. The [Selligate FAQ](https://selligate.com/pay-on-delivery-frequently-asked-questions/) distinguishes local delivery from waybills outside the hubs. Do not enable automatic waybills under these rules.

A placed order can reach the fulfilment group only if its state is covered, its delivery LGA is identifiable and covered, and the product is in stock in that state in the Selligate owner console. An excluded order still follows the existing order and Gmail notification flow. For mixed orders, only the eligible items may appear in the message. The final send check uses the latest address and stock selection.

## Review the LGA list

| State or territory | Listed hubs | LGAs enabled for automatic dispatch |
| --- | --- | --- |
| Lagos (LA) | Lagos | Agege, Ajeromi-Ifelodun, Alimosho, Amuwo-Odofin, Apapa, Eti Osa, Ifako-Ijaiye, Ikeja, Kosofe, Lagos Island, Lagos Mainland, Mushin, Ojo, Oshodi-Isolo, Shomolu, Surulere |
| Abuja / FCT (FC) | Abuja | Municipal Area Council |
| Rivers (RI) | Port Harcourt | Port Harcourt, Obio/Akpor |
| Kaduna (KD) | Kaduna | Kaduna North, Kaduna South |
| Kano (KN) | Kano | Dala, Fagge, Gwale, Kano Municipal, Kumbotso, Nasarawa, Tarauni, Ungogo |
| Akwa Ibom (AK) | Uyo, Eket | Uyo, Eket |
| Cross River (CR) | Calabar | Calabar Municipal, Calabar South |
| Oyo (OY) | Ibadan | Ibadan North, Ibadan North-East, Ibadan North-West, Ibadan South-East, Ibadan South-West |
| Ekiti (EK) | Ado Ekiti | Ado Ekiti |
| Ondo (ON) | Akure | Akure South |
| Abia (AB) | Umuahia, Aba | Umuahia North, Umuahia South, Aba North, Aba South |
| Sokoto (SO) | Sokoto | All recognised LGAs (owner’s statewide rule) |
| Osun (OS) | Osogbo | Osogbo, Olorunda |
| Benue (BE) | Makurdi | Makurdi |
| Anambra (AN) | Onitsha, Awka | Onitsha North, Onitsha South, Awka South |
| Delta (DE) | Warri, Ughelli, Asaba | Warri South, Ughelli North, Oshimili South |
| Kwara (KW) | Ilorin | Ilorin East, Ilorin South, Ilorin West |
| Kogi (KO) | Lokoja | Lokoja |
| Edo (ED) | Benin City | Egor, Ikpoba Okha, Oredo |
| Enugu (EN) | Enugu | All recognised LGAs (owner’s statewide rule) |
| Ogun (OG) | Abeokuta | Abeokuta North, Abeokuta South |
| Imo (IM) | Owerri | Owerri Municipal |
| Ebonyi (EB) | Abakaliki | Abakaliki |
| Niger (NI) | Minna | Chanchaga |
| Plateau (PL) | Jos | Jos North, Jos South |
| Bayelsa (BY) | Bayelsa | All recognised LGAs (owner’s statewide rule) |
| Nasarawa (NA) | Nasarawa | All recognised LGAs (owner’s statewide rule) |
| Bauchi (BA) | Bauchi | All recognised LGAs (owner’s statewide rule) |
| Katsina (KT) | Katsina | All recognised LGAs (owner’s statewide rule) |

The list follows the owner’s statewide rule for Sokoto, Enugu, Bayelsa, Nasarawa, Bauchi and Katsina. The public FAQ names Lafia for Nasarawa and also lists Ijebu-Ode. Confirm the statewide Nasarawa scope with the carrier before LIVE. Ijebu-Ode was not in the supplied list and is not enabled.

The broad city entries keep a conservative core: Lagos uses 16 listed LGAs, Abuja uses AMAC, Kaduna uses Kaduna North and Kaduna South, and Kano uses the eight listed metro LGAs. Confirm any additional areas before enabling them, including Ikorodu, Epe, Ibeju-Lekki and Badagry in Lagos; Bwari and the other councils outside AMAC in the FCT; and outer parts of Kaduna, Port Harcourt and the other cities. A metropolitan area can cross an LGA boundary. A city name alone does not mean every nearby LGA qualifies.

## Test while OFF

1. In Product availability, save Ekiti for Anagen only if stock is actually available there.
2. In Test laboratory choose Ekiti, Ado Ekiti and one pack. Run the dry-run preview. The route should qualify.
3. Leave product and state unchanged, choose Oye and preview again. It should show that the LGA is outside the delivery area. Neither preview creates an order or sends a message.
4. If Kaduna is already saved for the product, select Kaduna and leave Delivery LGA blank. Try the fictional address `12 Example Road, Barnawa, Kaduna` to see Kaduna South. Then try `12 Example Road, Sabon Tasha, Kaduna` to see Chikun excluded. Use a fictional street and a real neighbourhood for these previews.

## Address lookup when checkout leaves the LGA blank

After checking the existing LGA fields and locality hints, Renova searches the address and town fields against a local Nigerian settlement and ward index. Each lookup is limited to the selected state and includes all LGAs in that state. Renova still checks the full list of covered LGAs and the product's saved stock states before dispatching. A provided LGA still uses the original checks.

Dispatch History shows the identified LGA when the index resolved it. A road name alone, a broad city name, a different written state, or evidence pointing to multiple LGAs can leave an order for manual review. Renova does not send order details to a search or AI service, and publishing the lookup does not replay old jobs.

The bundled `selligate/data/grid3-address-index.json.gz` adapts [GRID3 NGA – Settlement Names](https://data.grid3.org/datasets/GRID3::grid3-nga-settlement-names/about). Credit: eHealth Africa, Proxy Logics, and Oak Ridge National Laboratory (ORNL), *Settlement Points in Nigeria* (2020), GRID3. The source is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Renova keeps the names and LGA labels, normalises spelling, and removes coordinates, editor details and other unused fields. The dataset does not verify individual houses or street numbers.

To refresh the index, download the CSV from the GRID3 source. From the Renova checkout, run:

```sh
node --input-type=module -e 'import { getAllStates, getLGAsByState } from "ng-geo-data"; console.log(JSON.stringify(getAllStates().map(s => ({...s, lgas: getLGAsByState(s.code)}))));' > /tmp/renova-lga-catalogue.json
python3 scripts/selligate/build-address-index.py /path/to/grid3-settlements.csv /tmp/renova-lga-catalogue.json selligate/data/grid3-address-index.json.gz
npm run test:selligate
```

## Geographic references

- [Nigeria Constitution, First Schedule](https://edojudiciary.gov.ng/wp-content/uploads/2016/10/1999-Nigerian-Constitution.pdf) and [INEC state and LGA directory](https://inecnigeria.org/about/resident-electoral-commissioners): formal state and LGA names. The deployed list is also checked against Renova’s checkout catalogue.
- [Ekiti State: Ado Ekiti](https://www.ekitistate.gov.ng/about-ekiti/local-government/ado-ekiti) and [Ekiti State: Oye](https://www.ekitistate.gov.ng/about-ekiti/local-government/oye): separate LGAs.
- [FCT Administration](https://fcta.gov.ng/faq/): AMAC is one of six area councils; FCT is not synonymous with AMAC.
- [Oyo State local governments](https://oyostate.gov.ng/local-governments/) and [Ibadan Urban Flood Management Project](https://www.ibadanflood.org/maps/ibadan-city): the greater Ibadan area extends beyond the five urban LGAs enabled here.
- [Anambra local councils](https://anambrastate.gov.ng/government/local-government-councils/): the list includes Onitsha North, Onitsha South and Awka South. Awka is the state capital.
- [Osun State: Osogbo](https://www.osunstate.gov.ng/o%E1%B9%A3ogbo/): Osogbo and Olorunda are the city’s two LGA headquarters.
- [Delta: Oshimili South](https://www.oslgc.dl.gov.ng/about), [Oshimili North](https://oshimilinorthlga.dl.gov.ng/about/), and [INEC Ughelli North](https://cvr.inecnigeria.org/locator/viewCentre/1214): distinguish Asaba, Okpanam and Ughelli.
- [Kano State LGA directory](https://kanostate.gov.ng/lgas/) and [Kano metropolitan geography](https://publications.umyu.edu.ng/scientifica/index.php/usci/article/download/12/643/1576?inline=1).
- [World Bank Lagos Resilience Project](https://documents1.worldbank.org/curated/en/099062123034023646/pdf/P1750310c8d0390000afa70e5c583aa3b87.pdf): the Lagos metropolitan area is smaller than the state; the table above gives Renova's initial automation list.
