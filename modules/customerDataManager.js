/**
 * Customer Data Manager Module
 * Manages Esploro customer list data with default and scraped sources
 */

const CustomerDataManager = (function() {
  'use strict';

  // ========== PRIVATE STATE ==========
  
  const STORAGE_KEY = 'customerListData';
  const DEFAULT_SOURCE = 'default';
  const SCRAPED_SOURCE = 'scraped';
  
  let currentSource = DEFAULT_SOURCE; // 'default' or 'scraped'
  let customerData = null;
  let isInitialized = false;

  // ========== DEFAULT CUSTOMER LIST ==========
  
  const defaultCustomerList = [
    {
        id: '0',
        institutionCode: 'TR_INTEGRATION_INST',
        server: 'na05',
        custID: '550',
        instID: '561',
        portalCustomDomain: 'https://tr-integration-researchportal.esploro.exlibrisgroup.com/esploro/',
        prefix: '',
        name: '',
        status: '',
        esploroEdition: 'Advanced',
        sandboxEdition: '',
        hasScopus: '',
        comments: 'Support Test environment'
    },
    {
        id: '1',
        institutionCode: '61SCU_INST',
        server: 'ap02',
        custID: '2350',
        instID: '2368',
        portalCustomDomain: 'http://researchportal.scu.edu.au',
        prefix: 'scu',
        name: 'Southern Cross University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '2',
        institutionCode: '61USC_INST',
        server: 'ap02',
        custID: '2620',
        instID: '2621',
        portalCustomDomain: 'http://research.usc.edu.au',
        prefix: 'usc',
        name: 'University of the Sunshine Coast',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '3',
        institutionCode: '44SUR_INST',
        server: 'eu00',
        custID: '2345',
        instID: '2346',
        portalCustomDomain: 'http://openresearch.surrey.ac.uk',
        prefix: 'surrey',
        name: 'University of Surrey',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '4',
        institutionCode: '39UBZ_INST',
        server: 'eu00',
        custID: '1230',
        instID: '1241',
        portalCustomDomain: 'http://bia.unibz.it',
        prefix: 'unibz',
        name: 'Libera Università di Bolzano',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '5',
        institutionCode: '39LUCC_INST',
        server: 'eu01',
        custID: '5125',
        instID: '5126',
        portalCustomDomain: 'http://arl.liuc.it',
        prefix: 'liuc',
        name: 'LIUC Università Carlo Cattaneo',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '6',
        institutionCode: '45FBI_INST',
        server: 'eu02',
        custID: '3740',
        instID: '3741',
        portalCustomDomain: 'http://research.fak.dk',
        prefix: 'fb',
        name: 'Forsvarsakademiet -Royal Danish Defence College',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '7',
        institutionCode: '01ADELPHI_INST',
        server: 'na01',
        custID: '6265',
        instID: '6266',
        portalCustomDomain: 'http://scholarlyworks.adelphi.edu',
        prefix: 'adelphi',
        name: 'Adelphi University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '8',
        institutionCode: '01ALLIANCE_WSU',
        server: 'na01',
        custID: '1840',
        instID: '1842',
        portalCustomDomain: 'http://rex.libraries.wsu.edu',
        prefix: 'alliance-wsu',
        name: 'Washington State University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB'
    },
    {
        id: '9',
        institutionCode: '01BRAND_INST',
        server: 'na01',
        custID: '1920',
        instID: '1921',
        portalCustomDomain: 'http://scholarworks.brandeis.edu',
        prefix: 'brandeis',
        name: 'Brandeis University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '10',
        institutionCode: '01CALS_USL',
        server: 'na03',
        custID: '1670',
        instID: '1671',
        portalCustomDomain: 'https://scholars.csus.edu/esploro/',
        prefix: 'csu-csus',
        name: 'California State University Sacramento',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '11',
        institutionCode: '01LANL_INST',
        server: 'na01',
        custID: '3760',
        instID: '3761',
        portalCustomDomain: 'http://laro.lanl.gov',
        prefix: 'lanl',
        name: 'Los Alamos National Lab',
        status: 'Completed',
        sandboxEdition: 'SB'
    },
    {
        id: '12',
        institutionCode: '01GALI_UGA',
        server: 'na03',
        custID: '2930',
        instID: '2959',
        portalCustomDomain: 'http://esploro.libs.uga.edu',
        prefix: 'galileo-uga',
        name: 'University of Georgia',
        status: 'Completed',
        esploroEdition: 'Standard',
        sandboxEdition: 'PSB'
    },
    {
        id: '13',
        institutionCode: '01UOML_INST',
        server: 'na03',
        custID: '2975',
        instID: '2976',
        portalCustomDomain: 'http://scholarship.miami.edu',
        prefix: 'miami',
        name: 'University of Miami Libraries',
        status: 'Completed',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '14',
        institutionCode: '01DRXU_INST',
        server: 'na04',
        custID: '4720',
        instID: '4721',
        portalCustomDomain: 'http://ResearchDiscovery.drexel.edu',
        prefix: 'drexel',
        name: 'Drexel University',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '15',
        institutionCode: '01IOWA_INST',
        server: 'na03',
        custID: '2770',
        instID: '2771',
        portalCustomDomain: 'http://iro.uiowa.edu',
        prefix: 'uiowa',
        name: 'University of Iowa',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '16',
        institutionCode: '01ECKERD_INST',
        server: 'na07',
        custID: '6110',
        instID: '6111',
        portalCustomDomain: 'https://ecscholar.eckerd.edu/esploro/',
        prefix: 'eckerd',
        name: 'Eckerd College',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '17',
        institutionCode: '01FDA_INST',
        server: 'na91',
        custID: '3805',
        instID: '3806',
        portalCustomDomain: 'fda-researchportal.esploro.exlibrisgroup.com',
        prefix: 'fda',
        name: 'U.S. Food and Drug Administration',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '18',
        institutionCode: '01RUT_INST',
        server: 'na04',
        custID: '4645',
        instID: '4646',
        portalCustomDomain: 'http://scholarship.libraries.rutgers.edu',
        prefix: 'rutgers',
        name: 'Rutgers University Libraries',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '19',
        institutionCode: '01UOLV_INST',
        server: 'na07',
        custID: '6310',
        instID: '6311',
        portalCustomDomain: 'http://researchworks.laverne.edu',
        prefix: 'laverne',
        name: 'University of La Verne',
        status: 'Completed',
        sandboxEdition: '-'
    },
    {
        id: '20',
        institutionCode: '01SUNY_ESF',
        server: 'na05',
        custID: '4800',
        instID: '4826',
        portalCustomDomain: 'http://experts.esf.edu',
        prefix: 'suny-esf',
        name: 'SUNY College of Environmental Science and Forestry',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '21',
        institutionCode: '01FALSC_FGCU',
        server: 'na07',
        custID: '6560',
        instID: '6570',
        portalCustomDomain: 'http://scholarscommons.fgcu.edu',
        prefix: 'fgcu-flvc',
        name: 'Florida Gulf Coast University',
        status: 'Completed',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '22',
        institutionCode: '01HC_INST',
        server: 'na06',
        custID: '7080',
        instID: '7081',
        portalCustomDomain: 'http://research.hillsdale.edu',
        prefix: 'hillsdale',
        name: 'Hillsdale College',
        status: 'Completed',
        sandboxEdition: 'SB'
    },
    {
        id: '23',
        institutionCode: '49HTW_INST',
        server: 'eu02',
        custID: '2580',
        instID: '2581',
        portalCustomDomain: 'http://fis.bib.htw-dresden.de',
        prefix: 'htw-dresden',
        name: 'Hochschule Fuer Technik Und Wirtschaft Dresden',
        status: 'Completed',
        sandboxEdition: 'PSB'
    },
    {
        id: '24',
        institutionCode: '01CRU_INST',
        server: 'na03',
        custID: '2655',
        instID: '2656',
        portalCustomDomain: 'https://researchworks.creighton.edu',
        prefix: 'creighton',
        name: 'Creighton University',
        status: 'Completed',
        sandboxEdition: 'SB',
        hasScopus: 'Yes'
    },
    {
        id: '25',
        institutionCode: '46SSOE_INST',
        server: 'eu00',
        custID: '6055',
        instID: '6056',
        portalCustomDomain: 'http://research.hhs.se',
        prefix: 'hhs',
        name: 'Stockholm School of Economics',
        status: 'Completed',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '26',
        institutionCode: '27UOJ_INST',
        server: 'eu04',
        custID: '7690',
        instID: '7691',
        portalCustomDomain: 'http://ujcontent.uj.ac.za',
        prefix: 'uoj',
        name: 'University of Johannesburg',
        status: 'Completed',
        esploroEdition: 'Standard',
        sandboxEdition: 'SB',
        comments: 'Non-Alma'
    },
    {
        id: '27',
        institutionCode: '61MUN_INST',
        server: 'ap02',
        custID: '7890',
        instID: '7891',
        portalCustomDomain: 'https://researchportal.murdoch.edu.au/esploro/',
        prefix: 'murdoch',
        name: 'Murdoch University',
        status: 'Completed',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '28',
        institutionCode: '01CLIC_STTHOMAS',
        server: 'na04',
        custID: '3685',
        instID: '3691',
        portalCustomDomain: 'researchonline.stthomas.edu',
        prefix: 'clic-stthomas',
        name: 'University of St. Thomas',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '29',
        institutionCode: '41ILO_INST',
        server: 'eu00',
        custID: '2675',
        instID: '2676',
        portalCustomDomain: 'https://researchrepository.ilo.org/esploro/',
        prefix: 'ilo',
        name: 'International Labour Organization',
        status: 'Completed',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '30',
        institutionCode: '01SUU_INST',
        server: 'na02',
        custID: '5235',
        instID: '5236',
        portalCustomDomain: 'susqu-researchportal.esploro.exlibrisgroup.com',
        prefix: 'susqu',
        name: 'Susquehanna University',
        status: 'Completed',
        esploroEdition: 'Standard',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '31',
        institutionCode: '01FALSC_UWF',
        server: 'na07',
        custID: '6560',
        instID: '6600',
        portalCustomDomain: 'https://ircommons.uwf.edu/esploro/',
        prefix: 'uwf-flvc',
        name: 'University of West Florida',
        status: 'Completed',
        sandboxEdition: 'PSB'
    },
    {
        id: '32',
        institutionCode: '01AUL_INST',
        server: 'na91',
        custID: '6835',
        instID: '6836',
        portalCustomDomain: 'faculty.af.edu',
        prefix: 'aul',
        name: 'Air University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'No longer a customer'
    },
    {
        id: '33',
        institutionCode: '966SDL_INST',
        server: 'eu04',
        custID: '8330',
        instID: '8331',
        portalCustomDomain: 'sindex.sdl.edu.sa',
        prefix: 'sdl',
        name: 'Saudi Digital Library',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        comments: 'Non-Alma'
    },
    {
        id: '34',
        institutionCode: '01UDEL_INST',
        server: 'na07',
        custID: '7700',
        instID: '7701',
        name: 'University of Delaware',
        status: 'Cancelled'
    },
    {
        id: '35',
        institutionCode: '01VAN_INST',
        server: 'na04',
        custID: '3275',
        instID: '3276',
        portalCustomDomain: 'http://facultyprofiles.vanderbilt.edu',
        prefix: 'vanderbilt',
        name: 'Vanderbilt University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '36',
        institutionCode: '01ALLIANCE_UID',
        server: 'na01',
        custID: '1840',
        instID: '1851',
        portalCustomDomain: 'https://verso.uidaho.edu/esploro/',
        prefix: 'alliance-uidaho',
        name: 'University of Idaho',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB'
    },
    {
        id: '37',
        institutionCode: '01VSU_INST',
        server: 'na06',
        custID: '7840',
        instID: '7841',
        portalCustomDomain: 'vsu-researchportal.esploro.exlibrisgroup.com',
        prefix: 'vsu',
        name: 'Virginia State University',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB'
    },
    {
        id: '38',
        institutionCode: '64OTAGO_INST',
        server: 'ap02',
        custID: '1890',
        instID: '1891',
        portalCustomDomain: 'http://ourarchive.otago.ac.nz',
        prefix: 'otago',
        name: 'University of Otago',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes'
    },
    {
        id: '39',
        institutionCode: '44UOBO_INST',
        server: 'eu04',
        custID: '8840',
        instID: '8841',
        portalCustomDomain: 'ub-ir.bolton.ac.uk',
        prefix: 'bolton',
        name: 'University of Bolton',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: 'Non-Alma'
    },
    {
        id: '40',
        institutionCode: '01MA_DM_INST',
        server: 'na03',
        custID: '1290',
        instID: '1301',
        portalCustomDomain: 'https://repository.lib.umassd.edu/',
        prefix: 'umassd',
        name: 'University of Massachusetts Dartmouth',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'No'
    },
    {
        id: '41',
        institutionCode: '64TEWANANGA_INST',
        server: 'ap02',
        custID: '4330',
        instID: '4331',
        portalCustomDomain: 'http://rangahau.twoa.ac.nz',
        prefix: 'twoa',
        name: 'Te Wānanga o Aotearoa',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'No'
    },
    {
        id: '42',
        institutionCode: '81UOT_INST',
        server: 'ap01',
        custID: '9300',
        instID: '9301',
        portalCustomDomain: 'http://r.dl.itc.u-tokyo.ac.jp',
        prefix: 'utokyo',
        name: 'University of Tokyo',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: 'Non-Alma'
    },
    {
        id: '43',
        institutionCode: '81UEC_INST',
        server: 'ap01',
        custID: '7420',
        instID: '7421',
        portalCustomDomain: 'https://www.researchportal.office.uec.ac.jp/',
        prefix: 'uec',
        name: 'The University of Electro-Communications',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: 'No'
    },
    {
        id: '44',
        institutionCode: '33UDM_INST',
        server: 'eu04',
        custID: '9310',
        instID: '9311',
        portalCustomDomain: 'http://esploro.umontpellier.fr',
        prefix: 'umontpellier',
        name: 'Université de Montpellier',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: 'Non-Alma'
    },
    {
        id: '45',
        institutionCode: '33EML_INST',
        server: 'eu04',
        custID: '9452',
        instID: '9453',
        prefix: 'emlyon',
        name: 'emlyon business school',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        comments: 'Non-Alma'
    },
    {
        id: '46',
        institutionCode: '61RMIT_INST',
        server: 'ap02',
        custID: '1330',
        instID: '1341',
        portalCustomDomain: 'http://researchrepository.rmit.edu.au',
        prefix: 'rmit',
        name: 'RMIT University at Melbourne',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB'
    },
    {
        id: '47',
        institutionCode: '886NKUST_INST',
        server: 'ap01',
        custID: '4120',
        instID: '4121',
        portalCustomDomain: 'http://researcher.nkust.edu.tw',
        prefix: 'nkust',
        name: 'National Kaohsiung University of Science and Technology',
        status: 'Completed',
        sandboxEdition: 'SB',
        comments: 'Sandbox institution code is 886KUAS_INST'
    },
    {
        id: '48',
        institutionCode: '972WIS_INST',
        server: 'eu02',
        custID: '3595',
        instID: '3596',
        portalCustomDomain: 'http://weizmann.esploro.exlibrisgroup.com',
        prefix: 'weizmann',
        name: 'Weizmann Institute of Science',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB'
    },
    {
        id: '49',
        institutionCode: '01TRAILS_UM',
        server: 'na02',
        custID: '3365',
        instID: '3367',
        portalCustomDomain: 'http://trails-um.esploro.exlibrisgroup.com',
        prefix: 'trails-um',
        name: 'University of Montana',
        status: 'Completed',
        sandboxEdition: 'PSB'
    },
    {
        id: '50',
        institutionCode: '01UODE_INST',
        server: 'na02',
        custID: '2765',
        instID: '2766',
        portalCustomDomain: 'http://du-researchportal.esploro.exlibrisgroup.com',
        prefix: 'du',
        name: 'University of Denver',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB'
    }
];

  // ========== PRIVATE FUNCTIONS ==========

  /**
   * Loads customer data from storage
   * @returns {Promise<Object>}
   */
  async function loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[CustomerDataManager] Error loading data:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        resolve(result[STORAGE_KEY] || null);
      });
    });
  }

  /**
   * Saves customer data to storage
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async function saveToStorage(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        if (chrome.runtime.lastError) {
          console.error('[CustomerDataManager] Error saving data:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Gets the active customer list based on current source
   * @returns {Array}
   */
  function getActiveList() {
    if (currentSource === SCRAPED_SOURCE && customerData && customerData.scraped) {
      return customerData.scraped.data || [];
    }
    return defaultCustomerList;
  }

  // ========== PUBLIC API ==========

  return {
    /**
     * Initializes the customer data manager
     */
    async init() {
      if (isInitialized) return;

      console.log('[CustomerDataManager] Initializing...');

      try {
        const stored = await loadFromStorage();
        
        if (stored) {
          customerData = stored;
          currentSource = stored.activeSource || DEFAULT_SOURCE;
          console.log(`[CustomerDataManager] Loaded ${currentSource} customer list`);
        } else {
          // Initialize with default
          customerData = {
            activeSource: DEFAULT_SOURCE,
            default: {
              count: defaultCustomerList.length,
              lastUpdate: null
            },
            scraped: null
          };
        }

        isInitialized = true;
        console.log(`[CustomerDataManager] Initialized with ${getActiveList().length} customers`);
      } catch (err) {
        console.error('[CustomerDataManager] Initialization error:', err);
        // Continue with defaults
        customerData = {
          activeSource: DEFAULT_SOURCE,
          default: { count: defaultCustomerList.length },
          scraped: null
        };
        isInitialized = true;
      }
    },

    /**
     * Finds customer by institution code with flexible matching
     * @param {string} institutionCode - Ex-Libris account number or institution code
     * @param {string} accountName - Optional account name for fallback matching
     * @returns {Object|null}
     */
    findByInstitutionCode(institutionCode, accountName = null) {
      if (!isInitialized) {
        console.warn('[CustomerDataManager] Not initialized, using default list');
      }

      const list = getActiveList();
      
      // Strategy 1: Exact match on institution code
      let customer = list.find(c => c.institutionCode === institutionCode);
      
      if (customer) {
        console.log(`[CustomerDataManager] Found customer (exact match): ${customer.name} (${institutionCode})`);
        return customer;
      }
      
      // Strategy 2: Check if institution code contains the Ex-Libris account number
      // Example: "61USC" should match "61USC_INST"
      if (institutionCode) {
        customer = list.find(c => c.institutionCode && c.institutionCode.includes(institutionCode));
        
        if (customer) {
          console.log(`[CustomerDataManager] Found customer (partial match): ${customer.name} (${institutionCode} matched ${customer.institutionCode})`);
          return customer;
        }
      }
      
      // Strategy 3: Fallback to account name matching if provided
      if (accountName) {
        // Try case-insensitive name match
        const normalizedAccountName = accountName.toLowerCase().trim();
        
        customer = list.find(c => {
          if (!c.name) return false;
          const customerName = c.name.toLowerCase().trim();
          // Check for exact match or if one contains the other
          return customerName === normalizedAccountName || 
                 customerName.includes(normalizedAccountName) ||
                 normalizedAccountName.includes(customerName);
        });
        
        if (customer) {
          console.log(`[CustomerDataManager] Found customer (name match): ${customer.name} matched "${accountName}"`);
          return customer;
        }
      }
      
      // No match found
      console.warn(`[CustomerDataManager] Customer not found: ${institutionCode}${accountName ? ` / "${accountName}"` : ''}`);
      return null;
    },

    /**
     * Finds customer by server
     * @param {string} server - e.g., 'ap02', 'eu00'
     * @returns {Array} Array of matching customers
     */
    findByServer(server) {
      if (!isInitialized) {
        console.warn('[CustomerDataManager] Not initialized, using default list');
      }

      const list = getActiveList();
      return list.filter(c => c.server && c.server.toLowerCase() === server.toLowerCase());
    },

    /**
     * Gets all customers
     * @returns {Array}
     */
    getAllCustomers() {
      return getActiveList();
    },

    /**
     * Gets current source
     * @returns {string} 'default' or 'scraped'
     */
    getCurrentSource() {
      return currentSource;
    },

    /**
     * Sets customer list source
     * @param {string} source - 'default' or 'scraped'
     * @returns {Promise<void>}
     */
    async setSource(source) {
      if (!isInitialized) {
        await this.init();
      }

      if (source !== DEFAULT_SOURCE && source !== SCRAPED_SOURCE) {
        console.error('[CustomerDataManager] Invalid source:', source);
        return;
      }

      if (source === SCRAPED_SOURCE && (!customerData.scraped || !customerData.scraped.data)) {
        console.error('[CustomerDataManager] No scraped data available');
        return;
      }

      currentSource = source;
      customerData.activeSource = source;

      await saveToStorage(customerData);
      console.log(`[CustomerDataManager] Switched to ${source} customer list`);
    },

    /**
     * Saves scraped customer data
     * @param {Array} scrapedData - Array of customer objects
     * @returns {Promise<void>}
     */
    async saveScrapedData(scrapedData) {
      if (!isInitialized) {
        await this.init();
      }

      customerData.scraped = {
        data: scrapedData,
        lastUpdate: Date.now(),
        count: scrapedData.length
      };

      await saveToStorage(customerData);
      console.log(`[CustomerDataManager] Saved ${scrapedData.length} scraped customers`);
    },

    /**
     * Gets customer data statistics
     * @returns {Object}
     */
    getStats() {
      return {
        activeSource: currentSource,
        defaultCount: defaultCustomerList.length,
        scrapedCount: customerData?.scraped?.count || 0,
        scrapedLastUpdate: customerData?.scraped?.lastUpdate || null,
        currentCount: getActiveList().length
      };
    },

    /**
     * Scrapes customer list from Wiki page
     * This should be called from background script via message passing
     * @returns {Promise<Array>} Scraped customer data
     */
    async scrapeWikiTable() {
      console.log('[CustomerDataManager] Wiki scraping not implemented yet');
      // This will be implemented when we create the Wiki scraping feature
      // For now, return empty array
      return [];
    },

    /**
     * Cleans up the module
     */
    cleanup() {
      if (!isInitialized) return;
      
      console.log('[CustomerDataManager] Cleaning up...');
      isInitialized = false;
    }
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomerDataManager;
}
