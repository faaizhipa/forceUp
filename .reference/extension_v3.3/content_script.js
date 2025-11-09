// content_script.js

// --- Global Variables ---
let featureSettings = null; // Stores enabled/disabled features
let themeSetting = null; // Stores current theme { theme: 'name', applyTo: 'sfdc'/'popup' }
let teamSelection = null; // Stores the selected team/BU for email validation
let mainObserver = null; // Main observer for performance
let observerTimeout = null; // Timeout for debouncing observer callbacks
const DEBOUNCE_DELAY = 1000; // Delay for observer debounce (milliseconds)
let vitalFieldsObserver = null; // Specific observer for the vital fields section injection
let extractorObserver = null; // Observer specific to the Case Comment extractor
let buttonsAdded = false; // Flag for Case Comment Extractor buttons
// New observers for specific features
let casesObserver = null;
let emailObserver = null;
let statusObserver = null;

// ** ADD NEW FEATURE FLAG ** Default Feature Settings
const defaultFeatures = {
    highlightCases: true,
    emailValidation: true,
    statusHighlighting: true,
    esploroDataDisplay: false,
    caseCommentExtractor: false,
    vitalFieldsDisplay: true, // Default value for the new feature
};

// --- METADATA ---
const esploroCustomerList = [
    {
        id: '0',
        institutionCode: 'TR_INTEGRATION_INST',
        server: 'na05',
        custID: '550',
        instID: '561',
        portalCustomDomain:
            'https://tr-integration-researchportal.esploro.exlibrisgroup.com/esploro/',
        prefix: '',
        name: '',
        status: '',
        esploroEdition: 'Advanced',
        sandboxEdition: '',
        hasScopus: '',
        comments: 'Support Test environment',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'Link to environment:\nhttps://na05.alma.exlibrisgroup.com/mng/login?institute=TR_INTEGRATION_INST&productCode=esploro&debug=true&auth=local\nUser: esploro_impl\npassword: a12345678A',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61SCU_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61SCU_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61USC_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61USC_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=44SUR_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=44SUR_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=39UBZ_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=39UBZ_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu01.alma.exlibrisgroup.com/mng/login?institute=39LUCC_INST&productCode=esploro&debug=true \nhttps://sqa02-eu01.alma.exlibrisgroup.com/mng/login?institute=39LUCC_INST&productCode=esploro&debug=true\nhttps://sqa03-eu01.alma.exlibrisgroup.com/mng/login?institute=39LUCC_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu01.alma.exlibrisgroup.com/esploro/?institution=39LUCC_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu02.alma.exlibrisgroup.com/mng/login?institute=45FBI_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu02.alma.exlibrisgroup.com/esploro/?institution=45FBI_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na01.alma.exlibrisgroup.com/mng/login?institute=01ADELPHI_INST&productCode=esploro&debug=true\nhttps://sqa02-na01.alma.exlibrisgroup.com/mng/login?institute=01ADELPHI_INST&productCode=esploro&debug=true\nhttps://sqa03-na01.alma.exlibrisgroup.com/mng/login?institute=01ADELPHI_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na01.alma.exlibrisgroup.com/esploro/?institution=01ADELPHI_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        sandboxEdition: 'SB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: 'https://alliance-wsu.esploro.exlibrisgroup.com/esploro/',
        directLinkToSqaEnvironment:
            'https://sqa-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_WSU&productCode=esploro&debug=true\nhttps://sqa02-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_WSU&productCode=esploro&debug=true\nhttps://sqa03-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_WSU&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na01.alma.exlibrisgroup.com/esploro/?institution=01ALLIANCE_WSU',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na01.alma.exlibrisgroup.com/mng/login?institute=01BRAND_INST&productCode=esploro&debug=true\nhttps://sqa02-na01.alma.exlibrisgroup.com/mng/login?institute=01BRAND_INST&productCode=esploro&debug=true\nhttps://sqa03-na01.alma.exlibrisgroup.com/mng/login?institute=01BRAND_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na01.alma.exlibrisgroup.com/esploro/?institution=01BRAND_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'No',
        comments: '',
        otbDomain: 'http://csu-csus.esploro.exlibrisgroup.com',
        directLinkToSqaEnvironment:
            'https://sqa03-na03.alma.exlibrisgroup.com/mng/login?institute=01CALS_USL&productCode=esploro&debug=true&auth=local\nhttps://qac01.alma.exlibrisgroup.com/mng/login?institute=01CALS_USL&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa03-na03.alma.exlibrisgroup.com/esploro/?institution=01CALS_USL',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na01.alma.exlibrisgroup.com/mng/login?institute=01LANL_INST&productCode=esploro&debug=true\nhttps://sqa02-na01.alma.exlibrisgroup.com/mng/login?institute=01LANL_INST&productCode=esploro&debug=true\nhttps://sqa03-na01.alma.exlibrisgroup.com/mng/login?institute=01LANL_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na01.alma.exlibrisgroup.com/esploro/?institution=01LANL_INST',
        oneTrust: 'V',
        discoveryAlma: 'Classic Primo'
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
        sandboxEdition: 'PSB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa03-na03.alma.exlibrisgroup.com/mng/login?institute=01GALI_UGA&productCode=esploro&debug=true\nhttps://sqa-na03.alma.exlibrisgroup.com/mng/login?institute=01GALI_UGA&productCode=esploro&debug=true\nhttps://sqa02-na03.alma.exlibrisgroup.com/mng/login?institute=01GALI_UGA&productCode=esploro\nhttps://qac01.alma.exlibrisgroup.com/mng/login?institute=01GALI_UGA&productCode=esploro',
        sqaPortalLink:
            'https://sqa03-na03.alma.exlibrisgroup.com/esploro/?institution=01GALI_UGA',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa03-na03.alma.exlibrisgroup.com/mng/login?institute=01UOML_INST&productCode=esploro&debug=true\nhttps://qac01.alma.exlibrisgroup.com/mng/login?institute=01UOML_INST&productCode=esploro\nhttps://sqa-na03.alma.exlibrisgroup.com/mng/login?institute=01UOML_INST&productCode=esploro\nhttps://sqa02-na03.alma.exlibrisgroup.com/mng/login?institute=01UOML_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa03-na03.alma.exlibrisgroup.com/esploro/?institution=01UOML_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na04.alma.exlibrisgroup.com/mng/login?institute=01DRXU_INST&productCode=esploro&debug=true\nhttps://sqa02-na04.alma.exlibrisgroup.com/mng/login?institute=01DRXU_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-na04.alma.exlibrisgroup.com/esploro/?institution=01DRXU_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa03-na03.alma.exlibrisgroup.com/mng/login?institute=01IOWA_INST&productCode=esploro&debug=true \nhttps://qac01.alma.exlibrisgroup.com/mng/login?institute=01IOWA_INST&productCode=esploro \nhttps://sqa02-na03.alma.exlibrisgroup.com/mng/login?institute=01IOWA_INST&productCode=esploro ',
        sqaPortalLink:
            'https://sqa03-na03.alma.exlibrisgroup.com/esploro/?institution=01IOWA_INST',
        oneTrust: 'V',
        discoveryAlma: 'Classic Primo \nand\nPrimo VE (views are not in use)'
    },
    {
        id: '16',
        institutionCode: '01ECKERD_INST',
        server: 'na07',
        custID: '6110',
        instID: '6111',
        portalCustomDomain:
            'https://ecscholar.eckerd.edu/esploro/\nhttp://scholar.eckerd.edu',
        prefix: 'eckerd',
        name: 'Eckerd College',
        status: 'Completed',
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na07.alma.exlibrisgroup.com/mng/login?institute=01ECKERD_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na07.alma.exlibrisgroup.com/esploro/?institution=01ECKERD_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'Available only via CyberArk - limited users can access',
        sqaPortalLink: '',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na04.alma.exlibrisgroup.com/mng/login?institute=01RUT_INST&productCode=esploro&debug=true\nhttps://sqa02-na04.alma.exlibrisgroup.com/mng/login?institute=01RUT_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-na04.alma.exlibrisgroup.com/esploro/?institution=01RUT_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: '-',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na07.alma.exlibrisgroup.com/mng/login?institute=01UOLV_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na07.alma.exlibrisgroup.com/esploro/?institution=01UOLV_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'No',
        comments: '',
        otbDomain:
            'https://suny-esf-researchportal.esploro.exlibrisgroup.com/esploro/',
        directLinkToSqaEnvironment:
            'https://sqa-na05.alma.exlibrisgroup.com/mng/login?institute=01SUNY_ESF&productCode=esploro&debug=true',
        sqaPortalLink: '',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na07.alma.exlibrisgroup.com/mng/login?institute=01FALSC_FGCU&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na07.alma.exlibrisgroup.com/esploro/?institution=01FALSC_FGCU',
        oneTrust: 'Testing SEO',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na06.alma.exlibrisgroup.com/mng/login?institute=01HC_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na06.alma.exlibrisgroup.com/esploro/?institution=01HC_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu02.alma.exlibrisgroup.com/mng/login?institute=49HTW_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu02.alma.exlibrisgroup.com/esploro/?institution=49HTW_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa03-na03.alma.exlibrisgroup.com/mng/login?institute=01CRU_INST&productCode=esploro&debug=true\nhttps://qac01.alma.exlibrisgroup.com/mng/login?institute=01CRU_INST&productCode=esploro\nhttps://sqa-na03.alma.exlibrisgroup.com/mng/login?institute=01CRU_INST&productCode=esploro\nhttps://sqa02-na03.alma.exlibrisgroup.com/mng/login?institute=01CRU_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa03-na03.alma.exlibrisgroup.com/esploro/?institution=01CRU_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu00.alma.exlibrisgroup.com/mng/login?institute=46SSOE_INST&productCode=esploro&debug=true\nhttps://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=46SSOE_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=46SSOE_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Didnt get response. Sent reminders',
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu04.alma.exlibrisgroup.com/mng/login?institute=27UOJ_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu04.alma.exlibrisgroup.com/esploro/?institution=27UOJ_INST',
        oneTrust: 'V',
        discoveryAlma: 'NA\nNo Alma customer'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=61MUN_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61MUN_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na04.alma.exlibrisgroup.com/mng/login?institute=01CLIC_STTHOMAS&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na04.alma.exlibrisgroup.com/esploro/?institution=01CLIC_STTHOMAS',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu00.alma.exlibrisgroup.com/mng/login?institute=41ILO_INST&productCode=esploro&debug=true\nhttps://sqa02-eu00.alma.exlibrisgroup.com/mng/login?institute=41ILO_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-eu00.alma.exlibrisgroup.com/esploro/?institution=41ILO_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na02.alma.exlibrisgroup.com/mng/login?institute=01SUU_INST&productCode=esploro&debug=true\nhttps://sqa02-na02.alma.exlibrisgroup.com/mng/login?institute=01SUU_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=61MUN_INST', // Note: This seems like a copy-paste error in the original HTML, points to Murdoch
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain:
            'https://uwf-flvc-researchmanagement.esplorisgroup.com/esploro/',
        directLinkToSqaEnvironment:
            'https://sqa-na07.alma.exlibrisgroup.com/mng/login?institute=01FALSC_UWF&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na07.alma.exlibrisgroup.com/esploro/?institution=01FALSC_UWF',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'No longer a customer',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'Available only via CyberArk - limited users can access',
        sqaPortalLink: '',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
    },
    {
        id: '33',
        institutionCode: '966SDL_INST',
        server: 'eu04',
        custID: '8330',
        instID: '8331',
        portalCustomDomain: 'sindex.sdl.edu.sa\n<s>srb.sdl.edu.sa</s>',
        prefix: 'sdl',
        name: 'Saudi Digital Library',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: 'Dont know who to send to but since they are not a library?',
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu04.alma.exlibrisgroup.com/mng/login?institute=966SDL_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-eu04.alma.exlibrisgroup.com/esploro/?institution=966SDL_INST',
        oneTrust: 'V',
        discoveryAlma: 'NA\nNo Alma customer'
    },
    {
        id: '34',
        institutionCode: '01UDEL_INST',
        server: 'na07',
        custID: '7700',
        instID: '7701',
        portalCustomDomain: '',
        prefix: '',
        name: 'University of Delaware',
        status: 'Cancelled',
        esploroEdition: '',
        sandboxEdition: '',
        hasScopus: 'Not a customer',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na07.alma.exlibrisgroup.com/mng/login?institute=01UDEL_INST&productCode=esploro&debug=true',
        sqaPortalLink:
            'https://sqa-na07.alma.exlibrisgroup.com/esploro/?institution=01UDEL_INST',
        oneTrust: '',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain:
            'https://vanderbilt-researchmanagement.esploro.exlibrisgroup.com/esploro/',
        directLinkToSqaEnvironment:
            'https://sqa-na04.alma.exlibrisgroup.com/mng/login?institute=01VAN_INST&productCode=esploro&debug=true\nhttps://sqa02-na04.alma.exlibrisgroup.com/mng/login?institute=01VAN_INST&productCode=esploro',
        sqaPortalLink:
            'https://sqa-na04.alma.exlibrisgroup.com/esploro/?institution=01VAN_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        sandboxEdition: 'SB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain:
            'https://alliance-uidaho-researchmanagement.esploro.exlibrisgroup.com/esploro/',
        directLinkToSqaEnvironment:
            'https://sqa-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_UID&productCode=esploro&debug=true\nhttps://sqa02-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_UID&productCode=esploro\nhttps://sqa03-na01.alma.exlibrisgroup.com/mng/login?institute=01ALLIANCE_UID&productCode=esploro',
        sqaPortalLink:
            'https://sqa-na01.alma.exlibrisgroup.com/esploro/?institution=01ALLIANCE_UID',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        sandboxEdition: 'SB',
        hasScopus: 'Didnt get response. Sent reminders',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na06.alma.exlibrisgroup.com/mng/login?institute=01VSU_INST&productCode=esploro&debug=true&auth=local',
        sqaPortalLink:
            'https://sqa-na06.alma.exlibrisgroup.com/esploro/?institution=01VSU_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        hasScopus: 'Yes',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-ap02.alma.exlibrisgroup.com/mng/login?institute=64OTAGO_INST&productCode=esploro&debug=true&auth=local&debug=true',
        sqaPortalLink:
            'https://sqa-ap02.alma.exlibrisgroup.com/esploro/?institution=64OTAGO_INST',
        oneTrust: 'V',
        discoveryAlma: 'Primo VE'
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
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-eu04.alma.exlibrisgroup.com/mng/login?institute=44UOBO_INST&productCode=esploro&debug=true&auth=local&debug=true',
        sqaPortalLink:
            'https://sqa-eu04.alma.exlibrisgroup.com/esploro/?institution=44UOBO_INST',
        oneTrust: 'V',
        discoveryAlma: 'NA\nNo Alma customer'
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
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: 'V',
        discoveryAlma: ''
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
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
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
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
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
        hasScopus: 'No',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
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
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '45',
        institutionCode: '33EML_INST',
        server: 'eu04',
        custID: '9452',
        instID: '9453',
        portalCustomDomain: 'TBD',
        prefix: 'emlyon',
        name: 'emlyon business school',
        status: 'In progress',
        esploroEdition: 'Advanced',
        sandboxEdition: 'SB',
        hasScopus: '? wasnt in my list from CS',
        comments: 'Non-Alma',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '46',
        institutionCode: '01NAVAL',
        server: 'TBD',
        custID: 'TBD',
        instID: 'TBD',
        portalCustomDomain: 'TBD',
        prefix: 'TBD',
        name: '',
        status: 'Booked',
        esploroEdition: '',
        sandboxEdition: '',
        hasScopus: '? wasnt in my list from CS',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '47',
        institutionCode: '01CCLI',
        server: 'TBD',
        custID: 'TBD',
        instID: 'TBD',
        portalCustomDomain: 'TBD',
        prefix: 'TBD',
        name: '',
        status: 'Booked',
        esploroEdition: '',
        sandboxEdition: '',
        hasScopus: '? wasnt in my list from CS',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '', // ID cell is empty
        institutionCode: '61RMIT_INST',
        server: 'ap02',
        custID: '1330',
        instID: '1341',
        portalCustomDomain: 'http://researchrepository.rmit.edu.au',
        prefix: 'rmit',
        name: 'RMIT University at Melbourne',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: '',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: 'V',
        discoveryAlma: ''
    },
    {
        id: '', // ID cell is empty
        institutionCode: '886NKUST_INST',
        server: 'ap01',
        custID: '4120',
        instID: '4121',
        portalCustomDomain: 'http://researcher.nkust.edu.tw',
        prefix: 'nkust',
        name: 'National Kaohsiung University of Science and Technology',
        status: 'Completed',
        esploroEdition: '',
        sandboxEdition: 'SB',
        hasScopus: '',
        comments: 'Sandbox institution code is 886KUAS_INST',
        otbDomain:
            'https://nkust-researchportal.esploro.exlibrisgroup.com/esploro/',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '', // ID cell is empty
        institutionCode: '972WIS_INST',
        server: 'eu02',
        custID: '3595',
        instID: '3596',
        portalCustomDomain: 'http://weizmann.esploro.exlibrisgroup.com',
        prefix: 'weizmann',
        name: 'Weizmann Institute of Science',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: '',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '', // ID cell is empty
        institutionCode: '01TRAILS_UM',
        server: 'na02',
        custID: '3365',
        instID: '3367',
        portalCustomDomain: 'http://trails-um.esploro.exlibrisgroup.com',
        prefix: 'trails-um',
        name: 'University of Montana',
        status: 'Completed',
        esploroEdition: '',
        sandboxEdition: 'PSB',
        hasScopus: '',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment: '',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    },
    {
        id: '', // ID cell is empty
        institutionCode: '01UODE_INST',
        server: 'na02',
        custID: '2765',
        instID: '2766',
        portalCustomDomain: 'http://du-researchportal.esploro.exlibrisgroup.com',
        prefix: 'du',
        name: 'University of Denver',
        status: 'Completed',
        esploroEdition: 'Advanced',
        sandboxEdition: 'PSB',
        hasScopus: '',
        comments: '',
        otbDomain: '',
        directLinkToSqaEnvironment:
            'https://sqa-na02.alma.exlibrisgroup.com/mng/login?institute=01UODE_INST&productCode=esploro\nhttps://sqa02-na02.alma.exlibrisgroup.com/mng/login?institute=01UODE_INST&productCode=esploro',
        sqaPortalLink: '',
        oneTrust: '',
        discoveryAlma: ''
    }
];

// = Insertion Functions for Esploro Customer =

const esploroData = esploroCustomerList; // Assign if needed globally

// Email Definitions
const emailEndNote = "endnote.support@clarivate.com";
const emailKeywordsEndNote = [
    "ts.",
    "ts-",
    "techstreet",
    "account",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "science",
    "custserv",
    "wos",
    "WOS",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailWoS = "wosg.support@clarivate.com";
const emailKeywordsWoS = [
    "ts.",
    "ts-",
    "techstreet",
    "account",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "custserv",
    "endnote",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailScholarOne = "s1help@clarivate.com";
const emailKeywordsScholarOne = [
    "ts.",
    "ts-",
    "techstreet",
    "account",
    "tr.",
    "queries",
    "wos",
    "WOS",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "custserv",
    "endnote",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailAccountSupport = "account.support@clarivate.com";
const emailKeywordsAccountSupport = [
    "ts.",
    "ts-",
    "techstreet",
    "endnote",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "science",
    "custserv",
    "wos",
    "WOS",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailLifeScience = "lifesciences.support@clarivate.com";
const emailKeywordsLifeScience = [
    "ts.",
    "ts-",
    "techstreet",
    "endnote",
    "science",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "science",
    "custserv",
    "wos",
    "WOS",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailLifeScienceHDS = "DRG.customerservice@clarivate.com";
const emailKeywordsLifeScienceHDS = [
    "ts.",
    "ts-",
    "techstreet",
    "endnote",
    "science",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "science",
    "custserv",
    "wos",
    "WOS",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
const emailLifeSciencePS = [
    "lsclientservicesdl@clarivate.com",
    "lifesciences.support@clarivate.com",
];
const emailKeywordsLifeSciencePS = [
    "ts.",
    "ts-",
    "techstreet",
    "endnote",
    "science",
    "tr.",
    "queries",
    "jgear",
    "jstead",
    "derwent",
    "customer",
    "scientific",
    "proposals",
    "service",
    "science",
    "custserv",
    "wos",
    "WOS",
    "collections",
    "invoices",
    "serion",
    "services",
    "compumark",
    "admin",
    "contract",
    "ipsci",
    "ips",
    "drg",
    "dartsip",
    "hidadataprogram",
    "cortellis",
    "compuMark",
    "account",
    "billing",
    "invoice",
    "certificate",
    "tax",
    "support",
    "askhbi",
    "cash",
    "team",
    "sales",
    "bis.in",
    "bis.mon",
    "bisqa",
];
let desiredTextSelection, emailKeywordsSelection; // Declare them

// --- Initialization Function ---
async function initializeContentScript() {
    // console.log("Initializing Content Script...");
    let attempts = 0;
    const maxAttempts = 5;
    const delay = 200;

    // Helper function to send message to background script (returns a Promise)
    const sendMessageToBackground = (message) => {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            chrome.runtime.lastError.message || "Unknown runtime error"
                        )
                    );
                } else {
                    resolve(response);
                }
            });
        });
    };

    while (attempts < maxAttempts) {
        try {
            // Fetch all settings concurrently
            const responses = await Promise.all([
                sendMessageToBackground({ message: "getFeatureSettings" }),
                sendMessageToBackground({ message: "getThemeSettings" }),
                sendMessageToBackground({ message: "getSavedSelection" }),
            ]);

            const [featureResponse, themeResponse, selectionResponse] = responses;

            // --- Process Feature Settings ---
            if (featureResponse?.status && featureResponse.data) {
                featureSettings = { ...defaultFeatures, ...featureResponse.data };
            } else {
                console.error(
                    "Failed to load feature settings:",
                    featureResponse?.error || "Response invalid"
                );
                featureSettings = { ...defaultFeatures }; // Use a fresh copy of defaults
            }
            // console.log("Feature settings loaded:", featureSettings);

            // --- Process Theme Settings ---
            if (themeResponse?.status && themeResponse.data) {
                themeSetting = themeResponse.data;
            } else {
                console.error(
                    "Failed to load theme settings:",
                    themeResponse?.error || "Response invalid"
                );
                themeSetting = { theme: "original", applyTo: "sfdc" }; // Default theme
            }
            // console.log("Theme settings loaded:", themeSetting);

            // --- Process Team Selection ---
            if (selectionResponse?.status && selectionResponse.data) {
                teamSelection = selectionResponse.data;
            } else {
                console.error(
                    "Failed to load team selection:",
                    selectionResponse?.error || "Response invalid"
                );
                teamSelection = "EndNote"; // Default team
            }
            // console.log("Team selection loaded:", teamSelection);
            updateEmailValidationConfig(); // Update config based on team

            // Apply initial theme and features
            applyThemeToPage(themeSetting.theme); // Apply theme first
            runEnabledFeatures(); // Run features based on loaded settings

            // Start observing DOM changes
            startObserving();

            // console.log("Content Script Initialized Successfully.");
            return; // Exit loop on success
        } catch (error) {
            attempts++;
            console.error(
                `Error during content script initialization (Attempt ${attempts}/${maxAttempts}):`,
                error
            );
            // Check for specific, potentially transient errors like connection issues
            if (
                error.message?.includes("Receiving end does not exist") ||
                error.message?.includes("Could not establish connection")
            ) {
                console.warn(
                    "Background script might not be ready yet or disconnected. Retrying..."
                );
                if (attempts >= maxAttempts) {
                    console.error(
                        "Max retries reached. Could not initialize content script settings. Applying defaults."
                    );
                    // Apply defaults as a fallback
                    featureSettings = { ...defaultFeatures };
                    themeSetting = { theme: "original", applyTo: "sfdc" };
                    teamSelection = "EndNote";
                    updateEmailValidationConfig();
                    applyThemeToPage(themeSetting.theme);
                    runEnabledFeatures();
                    startObserving();
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, delay * attempts)); // Exponential backoff
            } else {
                // Non-retryable error or other issue
                console.error(
                    "Unhandled error during initialization. Applying defaults."
                );
                featureSettings = { ...defaultFeatures };
                themeSetting = { theme: "original", applyTo: "sfdc" };
                teamSelection = "EndNote";
                updateEmailValidationConfig();
                applyThemeToPage(themeSetting.theme);
                runEnabledFeatures();
                startObserving();
                return; // Exit loop after applying defaults on fatal error
            }
        }
    }
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle Theme Application
    if (message.action === "applyTheme") {
        // console.log("Received theme application request:", message.themeName);
        try {
            applyThemeToPage(message.themeName); // Apply the theme
            // console.log("Theme applied in content script for:", message.themeName);
            sendResponse({ status: "Theme applied" });
        } catch (error) {
            console.error("Error applying theme in content script:", error);
            sendResponse({ status: "error", error: error.message });
        }
        // Indicate synchronous response
        return false;
    }

    // Handle Feature Settings Updates
    if (message.action === "updateFeatureSettings") {
        // console.log("Received feature settings update:", message.settings);
        const oldSettings = JSON.stringify(featureSettings);
        // Merge received settings with defaults to handle missing ones
        featureSettings = { ...defaultFeatures, ...(message.settings || {}) };

        if (JSON.stringify(featureSettings) !== oldSettings) {
            // console.log("Feature settings changed, re-running features.");
            runEnabledFeatures(); // Apply features immediately based on new state
            sendResponse({
                status: "success",
                message: "Feature settings updated and applied.",
            });
        } else {
            // console.log("Feature settings received, but no changes detected.");
            sendResponse({
                status: "success",
                message: "Feature settings received, no changes.",
            });
        }
        // Indicate synchronous response
        return false;
    }

    // Handle Team Selection Updates
    if (message.message === "saveSelection") {
        // Matching background script message
        // console.log("Received team selection update:", message.data);
        if (teamSelection !== message.data) {
            teamSelection = message.data;
            updateEmailValidationConfig(); // Update email validation based on new team
            // Re-run email validation highlighting if enabled
            if (featureSettings?.emailValidation) {
                handleAnchors();
            }
            sendResponse({ status: "success", message: "Team selection updated." });
        } else {
            sendResponse({
                status: "success",
                message: "Team selection received, no change.",
            });
        }
        // Indicate synchronous response
        return false;
    }

    // If the message is not handled, return false or undefined (default).
    // console.log("Message not handled by content script listener:", message);
    return false;
});

// --- Helper function to run enabled features based on current settings ---
function runEnabledFeatures() {
    // Cases highlighting
    if (featureSettings?.highlightCases) {
        handleCases();
    } else {
        unhighlightRowsByFunction();
    }

    // Email validation
    if (featureSettings?.emailValidation) {
        handleAnchors();
    } else {
        unhighlightAnchorsByFunction();
    }

    // Status highlighting
    if (featureSettings?.statusHighlighting) {
        handleStatus();
    } else {
        clearStatusHighlights();
    }

    // Esploro data display
    if (featureSettings?.esploroDataDisplay) {
        handleEsploroData();
    } else {
        removeEsploroSection();
    }

    // Case Comment Extractor
    if (featureSettings?.caseCommentExtractor) {
        initializeCaseCommentExtractor();
    } else {
        removeCopyButtons();
    }

    // Vital Fields Display
    if (featureSettings?.vitalFieldsDisplay) {
        initializeVitalFieldsDisplay();
    } else {
        removeVitalFieldsSection();
        clearVitalFieldHighlights();
    }
}

// --- Cleanup Functions (Remove effects when features are disabled) ---
function unhighlightRowsByFunction() {
    let webTables = document.querySelectorAll("table");
    for (let table of webTables) {
        const rows = table
            .querySelector("tbody")
            ?.querySelectorAll('tr[style*="background-color"]'); // Target rows with inline style
        if (!rows) continue;
        for (let row of rows) {
            // More robust: Check if style was added by this feature (e.g., using a data attribute)
            row.style.backgroundColor = "";
        }
    }
    // console.log("Cleared case highlights.");
}

function unhighlightAnchorsByFunction() {
    const fromFieldDiv = document.getElementsByClassName("standardField uiMenu");
    for (const fromDiv of fromFieldDiv) {
        const anchor = fromDiv.querySelector("a.select[style*='background-color']"); // Target anchors with inline style
        if (anchor) {
            anchor.style.backgroundColor = ""; // Remove background
        }
    }
    // ScholarOne cleanup
    const selectEmailElement = document.querySelector("select#p26");
    if (selectEmailElement) {
        selectEmailElement.style.backgroundColor = "";
    }
    // console.log("Cleared email validation highlights.");
}

function clearStatusHighlights() {
    let webTables = document.querySelectorAll("table");
    for (let table of webTables) {
        const rows = table.querySelector("tbody")?.querySelectorAll("tr");
        if (!rows) continue;
        for (let row of rows) {
            // Target spans potentially styled by handleStatus
            let cells = row.querySelectorAll(
                'td span span[style*="background-color"]'
            );
            for (let cell of cells) {
                cell.removeAttribute("style");
            }
        }
    }
    // console.log("Cleared status highlights.");
}

function removeEsploroSection() {
    const section = document.querySelector(".esploro-wrapper-block");
    if (section) {
        section.remove();
        // console.log("Removed Esploro data display section.");
    }
    // Also remove Esploro highlight timeout if active (though it might have fired already)
    // This requires tracking the timeout ID if handleEsploroData sets one.
    // For simplicity, assuming timeout is short-lived or handled internally.
    timeOutSetForEsploroDataDisplay = true;
}

function removeCopyButtons() {
    const buttons = document.querySelectorAll('[data-cc-extractor="true"]');
    buttons.forEach((btn) => btn.remove());
    buttonsAdded = false; // Reset flag
    if (extractorObserver) {
        extractorObserver.disconnect();
        extractorObserver = null;
    }
    // console.log("Removed Case Comment Extractor buttons.");
}

function removeVitalFieldsSection() {
    const section = document.getElementById(VITAL_FIELDS_SECTION_ID);
    if (section) {
        section.remove();
        // console.log("Removed Vital Fields section.");
        // Also remove highlights from main page fields
        clearVitalFieldHighlights();
    }
    if (vitalFieldsObserver) {
        vitalFieldsObserver.disconnect();
        vitalFieldsObserver = null;
    }
}

function clearVitalFieldHighlights() {
    const highlightedElements = document.querySelectorAll('.vital-field-highlight');
    highlightedElements.forEach(element => {
        element.classList.remove('vital-field-highlight');
    });
}

// --- Feature Initializers (Ensure they check if the feature is enabled) ---
function initializeEsploroDataDisplay() {
    if (!featureSettings?.esploroDataDisplay) return; // Check flag
    handleEsploroData(); // Call the function that sets the timeout
}

let timeOutSetForEsploroDataDisplay = false; // Flag from original code
async function handleEsploroData(case_number) {
    try {
        if (!timeOutSetForEsploroDataDisplay) {
            setTimeout(() => {
                if (typeof esploroData === "undefined") {
                    console.warn(
                        "WARNING: esploroData array is not defined! Details and Links blocks will not be shown. Please define the esploroData array."
                    );
                    // window.esploroData = [] // Define empty array to prevent errors in the function - esploroData is global const now
                }
                displayEsploroData(esploroData); // Pass data array
            }, 1000); // Adjust delay as needed
            timeOutSetForEsploroDataDisplay = true; // Set flag
        }
    } catch (error) {
        return; // Replace console.log with silent error handling
    }
}

function initializeCaseCommentExtractor() {
    if (!featureSettings?.caseCommentExtractor) return; // Check flag
    if (!window.location.pathname.match(/\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})/i)) {
        return; // Not on a case page
    }

    const tryAddButtons = () => {
        // Look for the UL element in the Communications tab
        const actionContainer = document.querySelector(
            '.branding-actions.slds-button-group[data-aura-class="oneActionsRibbon forceActionsContainer"]'
        );
        
        if (actionContainer) {
            if (actionContainer.querySelector('[data-cc-extractor="true"]')) {
                buttonsAdded = true;
                return true;
            }
            addCopyButtons(actionContainer);
            buttonsAdded = true;
            return true;
        }
        return false;
    };
   

    if (tryAddButtons()) return;

    if (extractorObserver) extractorObserver.disconnect();
    buttonsAdded = false;

    extractorObserver = new MutationObserver((mutations, obs) => {
        for (const mutation of mutations) {
            // Look for changes in tab visibility or content loading
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                if (tryAddButtons()) {
                    obs.disconnect();
                    extractorObserver = null;
                    break;
                }
            }
        }
    });

    // Observe the entire case view container for tab changes
    const observeTarget = document.querySelector(".oneConsole") || document.body;
    if (observeTarget) {
        extractorObserver.observe(observeTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-aura-rendered-by']
        });
    }
}

function initializeVitalFieldsDisplay() {
    if (!featureSettings?.vitalFieldsDisplay) return; // Check flag

    const tryInjectSection = () => {
        const pathAssistantArticle = document.querySelector(
            "article.slds-card .slds-path"
        );
        if (pathAssistantArticle) {
            const container = pathAssistantArticle.closest("article.slds-card");
            if (container) {
                if (!document.getElementById(VITAL_FIELDS_SECTION_ID)) {
                    injectVitalFieldsAndJiraSection(container); // Use await if inject is async
                } else {
                    updateVitalFieldsAndJiraSection(); // Use await if update is async
                }
                return true;
            }
        }
        return false;
    };

    if (vitalFieldsObserver) vitalFieldsObserver.disconnect();
    if (tryInjectSection()) return;

    vitalFieldsObserver = new MutationObserver((mutations, obs) => {
        if (tryInjectSection()) {
            obs.disconnect();
            vitalFieldsObserver = null;
        }
    });

    const observeTarget = document.querySelector(".oneConsole") || document.body;
    vitalFieldsObserver.observe(observeTarget, {
        childList: true,
        subtree: true,
    });
}

// --- Theme Application Function ---
function applyThemeToPage(themeName) {
    console.log(`Applying theme "${themeName}" to page body.`);
    try {
        applySfdcTheme(themeName); // Assumes this adds/removes '.sf-restyle-active'
        setTheme(themeName); // Assumes this potentially does more specific theme adjustments
    } catch (error) {
        console.error("Error applying theme to page:", error);
    }
}

// --- Update Email Validation Config ---
function updateEmailValidationConfig() {
    if (!teamSelection) {
        console.warn("Team selection not available for email validation config.");
        // Default to EndNote if no selection is loaded yet
        teamSelection = "EndNote";
    }
    console.log(`Updating email validation config for team: ${teamSelection}`);
    // Logic to set desiredTextSelection and emailKeywordsSelection based on teamSelection
    if (teamSelection === "EndNote") {
        desiredTextSelection = emailEndNote;
        emailKeywordsSelection = emailKeywordsEndNote;
    } else if (teamSelection === "ScholarOne") {
        desiredTextSelection = emailScholarOne;
        emailKeywordsSelection = emailKeywordsScholarOne;
    } else if (teamSelection === "WebOfScience") {
        desiredTextSelection = emailWoS;
        emailKeywordsSelection = emailKeywordsWoS;
    } else if (teamSelection === "AccountSupport") {
        desiredTextSelection = emailAccountSupport;
        emailKeywordsSelection = emailKeywordsAccountSupport;
    } else if (teamSelection === "LifeScience") {
        desiredTextSelection = emailLifeScience;
        emailKeywordsSelection = emailKeywordsLifeScience;
    } else if (teamSelection === "LifeScienceHDS") {
        desiredTextSelection = emailLifeScienceHDS;
        emailKeywordsSelection = emailKeywordsLifeScienceHDS;
    } else if (teamSelection === "LifeSciencePS") {
        desiredTextSelection = emailLifeSciencePS;
        emailKeywordsSelection = emailKeywordsLifeSciencePS;
    } else {
        console.warn(
            `Unknown team selection: ${teamSelection}. Defaulting email validation to EndNote.`
        );
        desiredTextSelection = emailEndNote; // Default
        emailKeywordsSelection = emailKeywordsEndNote; // Default
    }
    console.log("Desired Email:", desiredTextSelection);
}

// --- Observers ---
// Observe cases for highlighting
function startCasesObserver() {
    if (casesObserver) casesObserver.disconnect();
    if (!document.body) return;

    casesObserver = new MutationObserver(() => {
        if (featureSettings?.highlightCases) {
            handleCases();
        }
    });
    casesObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Initial call
    if (featureSettings?.highlightCases) {
        handleCases();
    }
}

// Observe email validations
function startEmailObserver() {
    if (emailObserver) emailObserver.disconnect();
    if (!document.body) return;

    emailObserver = new MutationObserver(() => {
        if (featureSettings?.emailValidation) {
            handleAnchors();
        }
    });
    emailObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Initial call
    if (featureSettings?.emailValidation) {
        handleAnchors();
    }
}

// Observe status highlights
function startStatusObserver() {
    if (statusObserver) statusObserver.disconnect();
    if (!document.body) return;

    statusObserver = new MutationObserver(() => {
        if (featureSettings?.statusHighlighting) {
            handleStatus();
        }
    });
    statusObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    // Initial call
    if (featureSettings?.statusHighlighting) {
        handleStatus();
    }
}

function startObserving() {
    stopObserving(); // Ensure previous observers are disconnected
    if (!document.body) {
        console.warn("Document body not ready for observing.");
        setTimeout(startObserving, 100);
        return;
    }
    console.log("Starting observers...");
    // Start feature-specific observers
    startCasesObserver();
    startEmailObserver();
    startStatusObserver();
}

function stopObserving() {
    // Cleanup for main observer
    if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
        console.log("Stopped main DOM observer.");
    }
    if (observerTimeout) {
        clearTimeout(observerTimeout);
        observerTimeout = null;
    }

    // Cleanup for feature-specific observers
    if (casesObserver) {
        casesObserver.disconnect();
        casesObserver = null;
        console.log("Stopped cases observer.");
    }
    if (emailObserver) {
        emailObserver.disconnect();
        emailObserver = null;
        console.log("Stopped email observer.");
    }
    if (statusObserver) {
        statusObserver.disconnect();
        statusObserver = null;
        console.log("Stopped status observer.");
    }
    // Other observers cleanup
    if (vitalFieldsObserver) {
        vitalFieldsObserver.disconnect();
        vitalFieldsObserver = null;
        console.log("Stopped vital fields observer.");
    }
    if (extractorObserver) {
        extractorObserver.disconnect();
        extractorObserver = null;
        console.log("Stopped extractor observer.");
    }
}

// Debounced observer callback
const handleDOMChanges = () => {
    if (observerTimeout) {
        clearTimeout(observerTimeout);
    }
    observerTimeout = setTimeout(() => {
        console.log("DOM changes detected, running enabled features...");
        runEnabledFeatures(); // Call the central function to apply based on current settings
    }, DEBOUNCE_DELAY);
};

// --- Feature Implementations & Helpers ---

// Theme Helpers
function applySfdcTheme(themeName) {
    if (themeName === "glassy") {
        document.body.classList.add("sf-restyle-active");
    } else {
        // original or others
        document.body.classList.remove("sf-restyle-active");
    }
}
function setTheme(selectedThemeTheme) {
    // Renamed param to avoid conflict
    if (!document.body) return;
    if (document.body.classList.contains("sf-restyle-active")) {
        if (selectedThemeTheme == "original") {
            document.body.classList.remove("sf-restyle-active");
        }
    } else {
        if (selectedThemeTheme != "original") {
            document.body.classList.add("sf-restyle-active");
        }
    }
}

// Email Validation Helpers
function isEndNoteSupportAnchor(anchor) {
    if (!desiredTextSelection) return false; // Guard against undefined
    let desiredText = desiredTextSelection;
    if (Array.isArray(desiredText)) {
        for (let item of desiredText) {
            if (anchor.textContent.includes(item)) {
                return true;
            }
        }
        return false;
    } else {
        return anchor.textContent.includes(desiredText);
    }
}
function isClarivateEmailList(anchor) {
    if (!emailKeywordsSelection) return false; // Guard against undefined
    const emailKeywords = emailKeywordsSelection;
    const clarivateDomain = "@clarivate.com";
    for (let keyword of emailKeywords) {
        if (
            anchor.textContent.includes(keyword) &&
            anchor.textContent.includes(clarivateDomain)
        ) {
            return true;
        }
    }
    return false;
}
function highlightAnchorWithSpecificContent(anchor, color) {
    anchor.style.backgroundColor = color;
}
function unhighlightAnchor(anchor) {
    anchor.style.backgroundColor = "";
}
function handleAnchors() {
    if (!featureSettings?.emailValidation) return;
    if (!desiredTextSelection || !emailKeywordsSelection) {
        console.warn("Email validation config not ready, skipping handleAnchors.");
        return;
    }
    const fromFieldDiv = document.getElementsByClassName("standardField uiMenu");
    for (const fromDiv of fromFieldDiv) {
        const anchor = fromDiv.querySelector("a.select");
        if (anchor) {
            // Check if anchor exists
            if (!isEndNoteSupportAnchor(anchor)) {
                if (!isClarivateEmailList(anchor)) {
                    highlightAnchorWithSpecificContent(anchor, "red");
                } else {
                    highlightAnchorWithSpecificContent(anchor, "orange");
                }
            } else {
                unhighlightAnchor(anchor);
            }
        }
    }
}
// ScholarOne Specific Email Validation
function emailPageCheck() {
    let h1Elements = document.getElementsByTagName("h1");
    for (let h1Element of h1Elements) {
        if (
            h1Element.className == "pageType" &&
            h1Element.textContent == "Email Message:"
        ) {
            return true;
        }
    }
    return false;
}
function changeS1AnchorBackgroundColor() {
    var selectEmailElement = document.querySelector("select#p26");
    if (!selectEmailElement) return;
    if (selectEmailElement.selectedIndex === 0) {
        selectEmailElement.style.backgroundColor = "#ff9eb6"; // Red
    } else if (selectEmailElement.selectedIndex === 11) {
        // Assuming index 11 is the "correct" one
        selectEmailElement.style.backgroundColor = ""; // Normal
    } else {
        selectEmailElement.style.backgroundColor = "#ffd676"; // Orange
    }
}
function scholarOneHandleAnchor() {
    if (!featureSettings?.emailValidation) return;
    if (emailPageCheck()) {
        changeS1AnchorBackgroundColor(); // Initial check
        const selectElement = document.querySelector("select#p26");
        if (selectElement) {
            // Remove previous listener if any to prevent duplicates
            selectElement.removeEventListener(
                "change",
                changeS1AnchorBackgroundColor
            );
            // Add listener
            selectElement.addEventListener("change", changeS1AnchorBackgroundColor);
        }
    }
}

// Case Highlighting Helpers
function getEarlierDate(date1Str, date2Str) {
    const date1 = new Date(date1Str);
    const date2 = new Date(date2Str);
    return date1 < date2 ? date1 : date2;
}
function calculateTimeDifferenceInMinutes(date) {
    const openDate = new Date(date);
    const currentDate = new Date();
    const timeDifferenceInMilliseconds = Math.abs(currentDate - openDate);
    return timeDifferenceInMilliseconds / (1000 * 60);
}
function isValidDateFormat(textContent) {
    const datePattern =
        /^(1[0-2]|0?[1-9])\/(3[01]|[12][0-9]|0?[1-9])\/\d{4} (1[0-2]|0?[1-9]):([0-5][0-9]) (AM|PM)$/;
    return datePattern.test(textContent);
}
function isValidDateFormat2(textContent) {
    const datePattern =
        /^(3[01]|[12][0-9]|0?[1-9])\/(1[0-2]|0?[1-9])\/\d{4} (1[0-2]|0?[1-9]):([0-5][0-9]) (AM|PM)$/;
    return datePattern.test(textContent);
}
function isValidDateFormatDDMMnoAMPM(textContent) {
    const datePattern =
        /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[012])\/\d{4} ([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return datePattern.test(textContent);
}
function isValidDateFormatMMDDnoAMPM(textContent) {
    const datePattern =
        /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4} ([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return datePattern.test(textContent);
}
function convertDateFormat2(inputDate) {
    // DD/MM/YYYY HH:MM AM/PM -> MM/DD/YYYY HH:MM AM/PM
    const parts = inputDate.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/
    );
    if (!parts) return inputDate; // Return original if format doesn't match
    return `${parts[2]}/${parts[1]}/${parts[3]} ${parts[4]}:${parts[5]} ${parts[6]}`;
}
function getDayOfMonth() {
    return new Date().getDate();
}
function getCurrentMonth() {
    return new Date().getMonth() + 1;
}
function getCurrentYear() {
    return new Date().getFullYear();
}
function convertDateFormatDDMMwithAMPM(dateString) {
    // DD/MM/YYYY HH:MM -> MM/DD/YYYY HH:MM AM/PM
    const parts = dateString.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/
    );
    if (!parts) return dateString;
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    const hours = parseInt(parts[4], 10);
    const minutes = parseInt(parts[5], 10);
    const date = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(date.getTime())) return dateString; // Invalid date
    const hours12 = date.getHours() % 12 || 12;
    const amPm = date.getHours() < 12 ? "AM" : "PM";
    return (
        `${String(month).padStart(2, "0")}/${String(day).padStart(
            2,
            "0"
        )}/${year} ` +
        `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0"
        )} ${amPm}`
    );
}
function convertDateFormatMMDDwithAMPM(dateString) {
    // MM/DD/YYYY HH:MM -> MM/DD/YYYY HH:MM AM/PM
    const parts = dateString.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/
    );
    if (!parts) return dateString;
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const year = parseInt(parts[3], 10);
    const hours = parseInt(parts[4], 10);
    const minutes = parseInt(parts[5], 10);
    const date = new Date(year, month - 1, day, hours, minutes);
    if (isNaN(date.getTime())) return dateString; // Invalid date
    const hours12 = date.getHours() % 12 || 12;
    const amPm = date.getHours() < 12 ? "AM" : "PM";
    return (
        `${String(month).padStart(2, "0")}/${String(day).padStart(
            2,
            "0"
        )}/${year} ` +
        `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(
            2,
            "0"
        )} ${amPm}`
    );
}
function convertDateFormat(inputDate) {
    // Auto-detect MM/DD or DD/MM based on context
    const parts = inputDate.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/
    );
    if (!parts) return inputDate;
    const firstDatePart = parseInt(parts[1], 10);
    const secondDatePart = parseInt(parts[2], 10);
    const year = parts[3];
    const timePart = parts[4];
    const minutePart = parts[5];
    const amPmPart = parts[6];

    const currentDayOfMonth = getDayOfMonth();
    const currentMonth = getCurrentMonth();
    let day, month;

    // Basic heuristic (can be improved)
    if (firstDatePart > 12 && secondDatePart <= 12) {
        // DD/MM/YYYY
        day = firstDatePart;
        month = secondDatePart;
    } else if (firstDatePart <= 12 && secondDatePart > 12) {
        // MM/DD/YYYY
        day = secondDatePart;
        month = firstDatePart;
    } else {
        // Ambiguous (e.g., 05/06/2024) - Assume MM/DD for US locale default
        month = firstDatePart;
        day = secondDatePart;
    }
    // Format to MM/DD/YYYY
    return `${String(month).padStart(2, "0")}/${String(day).padStart(
        2,
        "0"
    )}/${year} ${timePart}:${minutePart} ${amPmPart}`;
}
function hasOpenButNotReopened(rowElement) {
    const statusElements = rowElement.querySelectorAll("td span span"); // Adjust selector if needed
    let isOpenFound = false;
    let isReopenedFound = false;
    let isNewFound = false;

    statusElements.forEach((element) => {
        const textContent = element.textContent.trim();
        if (textContent === "Open") isOpenFound = true;
        else if (textContent === "Re-opened") isReopenedFound = true;
        else if (textContent === "New") isNewFound = true;
    });

    return isNewFound || (isOpenFound && !isReopenedFound);
}
function handleCases() {
    if (!featureSettings?.highlightCases) return;
    let webTables = document.querySelectorAll("table");
    for (let table of webTables) {
        const tbody = table.querySelector("tbody");
        if (!tbody) continue;
        const rows = tbody.querySelectorAll("tr");
        for (let row of rows) {
            if (hasOpenButNotReopened(row)) {
                const dateArray = [];
                const dateElements = row.querySelectorAll(
                    "td span span, td lightning-formatted-date-time"
                ); // Broader selector

                dateElements.forEach((element) => {
                    const textContent = element.textContent.trim();
                    let convertedDate = null;

                    if (isValidDateFormat(textContent)) {
                        // MM/DD/YYYY HH:MM AM/PM
                        convertedDate = convertDateFormat(textContent); // Use the intelligent one
                    } else if (isValidDateFormat2(textContent)) {
                        // DD/MM/YYYY HH:MM AM/PM
                        convertedDate = convertDateFormat2(textContent); // Convert DD/MM to MM/DD
                    } else if (isValidDateFormatDDMMnoAMPM(textContent)) {
                        // DD/MM/YYYY HH:MM
                        const addedAMPM = convertDateFormatDDMMwithAMPM(textContent);
                        convertedDate = convertDateFormat2(addedAMPM); // Convert DD/MM to MM/DD
                    } else if (isValidDateFormatMMDDnoAMPM(textContent)) {
                        // MM/DD/YYYY HH:MM
                        convertedDate = convertDateFormatMMDDwithAMPM(textContent); // Just add AM/PM
                    }

                    if (convertedDate) {
                        dateArray.push(convertedDate);
                    }
                });

                let earlierDate;
                if (dateArray.length === 2) {
                    earlierDate = getEarlierDate(dateArray[0], dateArray[1]);
                } else if (dateArray.length === 1) {
                    earlierDate = new Date(dateArray[0]);
                } else {
                    continue; // No valid dates found for this row
                }

                if (isNaN(earlierDate?.getTime())) continue; // Invalid date object

                const caseMinutes = calculateTimeDifferenceInMinutes(earlierDate);
                let color = "";
                if (caseMinutes > 90) color = "rgb(255, 220, 230)"; // Light Red
                else if (caseMinutes > 60) color = "rgb(255, 232, 184)"; // Light Orange
                else if (caseMinutes > 30) color = "rgb(209, 247, 196)"; // Light Green
                else color = "rgb(194, 244, 233)"; // Light Blue

                row.style.backgroundColor = color;
            } else {
                // Only remove background if it was potentially added by this feature
                if (row.style.backgroundColor) {
                    row.style.backgroundColor = "";
                }
            }
        }
    }
}

// Status Highlighting Helpers
function generateStyle(color) {
    return `background-color: ${color}; border-radius: 6px; padding: 3px 6px; color: white; font-weight: 500; display: inline-block;`; // Added display
}
function handleStatus() {
    if (!featureSettings?.statusHighlighting) return;
    let webTables = document.querySelectorAll("table");

    for (let table of webTables) {
        const tbody = table.querySelector("tbody");
        if (!tbody) continue;
        const rows = tbody.querySelectorAll("tr");
        for (let row of rows) {
            // Target status cells more precisely if possible (e.g., by data-label or column index)
            // This example targets spans within spans inside TDs, which might be too broad
            let cells = row.querySelectorAll("td span span"); // Adjust selector as needed
            for (let cell of cells) {
                let cellText = cell.textContent.trim();
                let style = "";
                switch (cellText) {
                    case "New Email Received":
                    case "Re-opened":
                    case "Reopened":
                    case "Transferred":
                    case "Internally Returned":
                    case "Completed by Resolver Group":
                    case "New":
                    case "Update Received":
                        style = generateStyle("rgb(191, 39, 75)"); // Red
                        break;
                    case "Pending Action":
                    case "Initial Response Sent":
                    case "In Progress":
                        style = generateStyle("rgb(247, 114, 56)"); // Orange
                        break;
                    case "Assigned to Resolver Group":
                    case "Pending Internal Response":
                    case "Pending AM Response":
                    case "Pending QA Review":
                        style = generateStyle("rgb(140, 77, 253)"); // Purple
                        break;
                    case "Solution Delivered to Customer":
                        style = generateStyle("rgb(45, 200, 64)"); // Green
                        break;
                    case "Closed":
                    case "Awaiting Customer Confirmation":
                    case "Resolved":
                    case "Resolved by Resolver Group":
                    case "Pending":
                    case "Pending Customer Response":
                        style = generateStyle("rgb(103, 103, 103)"); // Grey
                        break;
                    case "Pending System Update - Defect":
                    case "Pending System Update - Enhancement":
                    case "Pending System Update - Other":
                        style = generateStyle("rgb(251, 178, 22)"); // Yellow/Gold
                        break;
                    default:
                        // If style was potentially added before, remove it
                        if (cell.hasAttribute("style")) {
                            cell.removeAttribute("style");
                        }
                        continue; // Skip applying style if no match
                }
                if (style) {
                    cell.setAttribute("style", style);
                }
            }
        }
    }
}

// Esploro Data Display Helpers
function createDetailItemColumnWrap(label, value) {
    if (!value && value !== 0 && typeof value !== "string") return null;
    const itemDiv = document.createElement("div");
    itemDiv.style.marginBottom = "var(--lwc-spacingSmall, 0.3rem)";
    itemDiv.style.padding = "var(--lwc-spacingXSmall, 0.5rem)";
    itemDiv.style.boxSizing = "border-box";
    const labelP = document.createElement("p");
    labelP.className = "slds-text-title slds-truncate";
    labelP.title = label;
    labelP.textContent = label;
    itemDiv.appendChild(labelP);
    const valueP = document.createElement("p");
    valueP.className = "slds-text-body--regular slds-truncate"; // Keep truncate for consistency, adjust if needed
    // Allow wrapping specifically for the Query value
    if (label === "Query") {
        valueP.style.whiteSpace = "pre-wrap"; // Allows wrapping on spaces/newlines
        valueP.style.overflowWrap = "break-word"; // Breaks long words if necessary
        valueP.classList.remove("slds-truncate"); // Remove truncation for query
    }
    valueP.textContent = value;
    itemDiv.appendChild(valueP);
    return itemDiv;
}
function createLinkButton(text, url) {
    // Basic URL validation
    if (
        !url ||
        typeof url !== "string" ||
        url.trim() === "" ||
        !(url.startsWith("http:") || url.startsWith("https://"))
    ) {
        console.warn(`Skipping button creation for invalid/empty URL: ${url}`);
        return null;
    }
    try {
        new URL(url); // Test if URL is parsable
    } catch (e) {
        console.warn(`Skipping button creation for unparsable URL: ${url}`);
        return null;
    }

    const button = document.createElement("button");
    button.className = "slds-button slds-button_neutral";
    button.style.margin = "0.1rem"; // Add small margin
    button.textContent = text;
    button.title = `Open ${url}`;
    button.onclick = () => window.open(url, "_blank");
    return button;
}
// ADD this new helper function near createLinkButton or other helpers
/**
 * Creates an inline DIV structure for displaying a label and value, mimicking a form field.
 */
function createInlineDetailItem(label, value) {
    // Skip if value is essentially empty (null, undefined, or empty string)
    // Allow 0 as a valid value.
    if (value === null || typeof value === "undefined" || value === "")
        return null;

    const itemDiv = document.createElement("div");
    // Using SLDS classes to mimic standard field layout
    itemDiv.className =
        "slds-form-element slds-m-bottom_x-small";
    itemDiv.style.padding = "0 var(--lwc-spacingXSmall, 0.5rem)"; // Add some horizontal padding

    const labelSpan = document.createElement("span");
    labelSpan.className = "slds-form-element__label"; // Style as a label
    labelSpan.textContent = label;
    itemDiv.appendChild(labelSpan);

    const valueDiv = document.createElement("div");
    valueDiv.className = "slds-form-element__control slds-text-body_regular"; // Control container for value

    // Keep special handling for query: make it wrap and use monospace font
    if (label === "Query") {
        valueDiv.style.whiteSpace = "pre-wrap"; // Allows wrapping on spaces/newlines
        valueDiv.style.overflowWrap = "break-word"; // Breaks long words if necessary
        valueDiv.style.fontFamily = "monospace"; // Make query look like code
        valueDiv.style.backgroundColor = "rgba(200, 200, 200, 0.1)"; // Slight background tint
        valueDiv.style.padding = "0.2rem";
        valueDiv.style.borderRadius = "var(--lwc-borderRadiusMedium, 0.25rem)";
    }

    valueDiv.textContent = value; // Set the value text
    itemDiv.appendChild(valueDiv);
    return itemDiv;
}

// REPLACE the existing displayEsploroData function with this modified version:
/**
 * Main function to inject Esploro info and regional world clocks.
 * Displays Details as an inline column alongside Links and Time blocks.
 * @param {Array|undefined} dataArray The Esploro data array (can be undefined).
 */
function displayEsploroData(dataArray) {
    console.log(
        'Attempting to display Esploro data (inline details) & world clocks...'
    );

    if (typeof dataArray === 'undefined' || !Array.isArray(dataArray)) {
        console.warn(
            'Esploro data array is missing or invalid. Details/Links blocks require data.'
        )
        dataArray = []
    }

    // --- 1. Get Matching Values from Salesforce Page ---
    let accountName = null;
    let exLibrisAccountNumber = null;
    try {
        // Try multiple selectors for Account Name
        const accNameSelectors = [
            'records-record-layout-item[field-label="Account Name"] records-hoverable-link a span slot span slot span',
            'div.secondaryFields records-highlights-details-item p.slds-text-title[title="Account Name"] + p.fieldComponent force-lookup a span slot span slot span',
            'slot[name="outputField"] records-formula-output span lightning-formatted-url a',
            'slot[name="outputField"] span lightning-formatted-text',
        ];
        for (const selector of accNameSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                if (selector.includes('lightning-formatted-url a') && element.textContent.trim() === "URL") {
                    accountName = element.getAttribute('href');
                } else {
                    accountName = element.textContent.trim();
                }
                if (accountName) { console.log(`Found Account Name with selector "${selector}":`, accountName); break; }
            }
        }
        if (!accountName) console.warn('Could not find Account Name element.');
    } catch (e) { console.error('Error finding Account Name:', e); }
    try {
        // Try multiple selectors for Ex Libris Account Number
        const accNumSelectors = [
            'records-record-layout-item[field-label="Ex Libris Account Number"] lightning-formatted-text',
            'div.secondaryFields records-highlights-details-item p.slds-text-title[title="Ex Libris Account Number"] + p.fieldComponent lightning-formatted-text',
        ];
        for (const selector of accNumSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                exLibrisAccountNumber = element.textContent.trim().replace(/-/g, '_');
                console.log(`Found Normalized Ex Libris Account Number with selector "${selector}":`, exLibrisAccountNumber);
                break;
            }
        }
        if (!exLibrisAccountNumber) console.warn('Could not find Ex Libris Account Number element.');
    } catch (e) { console.error('Error finding Ex Libris Account Number:', e); }

    // --- 2. Find Matching Record in Data Array ---
    let foundRecord = null;
    if ((accountName || exLibrisAccountNumber) && dataArray.length > 0) {
        foundRecord = dataArray.find(record =>
            (exLibrisAccountNumber && record.institutionCode && exLibrisAccountNumber.toLowerCase() === record.institutionCode.replace(/-/g, '_').toLowerCase()) ||
            (accountName && record.name && accountName.toLowerCase() === record.name.toLowerCase())
        );
        if (foundRecord) console.log('Found matching record:', foundRecord);
        else console.log('No matching Esploro record found.');
    } else if (dataArray.length > 0) {
        console.log('No Account Name or Ex Libris Account Number found on page.');
    }

    // --- 3. Get Target Parent Container ---
    const parentContainer = document.querySelector('div.secondaryFields');
    if (!parentContainer) {
        console.error("Could not find the parent container 'div.secondaryFields'.");
        setTimeout(() => {
            displayEsploroData(dataArray); // Retry after a short delay
        }, 10000); // Adjust delay as needed
        return;
    }

    // --- 4. Clear Previously Added Elements ---
    const existingWrapper = parentContainer.querySelector('.esploro-wrapper-block');
    if (existingWrapper) existingWrapper.remove();

    // --- Create Main Wrapper ---
    const esploroWrapper = document.createElement('div');
    esploroWrapper.className = 'esploro-wrapper-block slds-grid slds-gutters_small slds-wrap slds-m-vertical_small';
    esploroWrapper.style.alignItems = 'stretch'; // Try to make columns equal height

    // --- Create Placeholder Containers for Columns ---
    // NEW: Details column (will not have slds-box styling)
    const detailsColumn = document.createElement('div');
    detailsColumn.className = 'esploro-details-column slds-col slds-size_1-of_1 slds-medium-size_1-of_2 slds-large-size_1-of_5 slds-box slds-theme_shade'; // Add box styling back for consistency

    // Links container (keeps box styling)
    const linksContainer = document.createElement('div');
    linksContainer.className = 'esploro-links-block slds-col slds-size_1-of_1 slds-medium-size_1-of_2 slds-large-size_1-of_5 slds-box slds-theme_shade';

    // Time containers (keep box styling)
    const apTimeContainer = document.createElement('div'); apTimeContainer.id = 'esploro-ap-times';
    apTimeContainer.className = 'esploro-ap-times-block slds-col slds-size_1-of_1 slds-medium-size_1-of_2 slds-large-size_1-of_5 slds-box slds-theme_shade';
    const euTimeContainer = document.createElement('div'); euTimeContainer.id = 'esploro-eu-times';
    euTimeContainer.className = 'esploro-eu-times-block slds-col slds-size_1-of_1 slds-medium-size_1-of_2 slds-large-size_1-of_5 slds-box slds-theme_shade';
    const naTimeContainer = document.createElement('div'); naTimeContainer.id = 'esploro-na-times';
    naTimeContainer.className = 'esploro-na-times-block slds-col slds-size_1-of_1 slds-medium-size_1-of_2 slds-large-size_1-of_5 slds-box slds-theme_shade';

    let blocksToAppend = []; // Array to hold the columns/containers to append
    let hasDetails = false, hasLinks = false, apTimeContent = false, euTimeContent = false, naTimeContent = false;

    // --- 5. Populate Details Column (Modified) ---
    if (foundRecord) {
        const detailsTitle = document.createElement('p');
        detailsTitle.className = 'slds-text-heading_small slds-p-bottom_small slds-p-horizontal_small'; // Add padding
        detailsTitle.textContent = 'Esploro Details';
        detailsColumn.appendChild(detailsTitle); // Add title to the column

        const fieldsToShow = [
            { label: 'Institution Code', key: 'institutionCode' }, { label: 'Server', key: 'server' },
            { label: 'CustID', key: 'custID' }, { label: 'InstID', key: 'instID' },
            { label: 'Prefix', key: 'prefix' },
            { label: 'Query', value: (record) => `SELECT * FROM table WHERE customerid = ${record.custID || '??'} AND institutionid = ${record.instID || '??'}` },
            { label: 'Esploro Edition', key: 'esploroEdition' }
        ];

        fieldsToShow.forEach(field => {
            const value = field.key ? foundRecord[field.key] : (field.value ? field.value(foundRecord) : '');
            // Use the NEW helper function createInlineDetailItem
            const detailItem = createInlineDetailItem(field.label, value);
            if (detailItem) {
                detailsColumn.appendChild(detailItem); // Append directly to the column
                hasDetails = true;
            }
        });
    }
    // Add the details column to the list if it has content
    if (hasDetails) blocksToAppend.push(detailsColumn);

    // --- 6. Populate Links Block (Unchanged logic, just appends to linksContainer) ---
    if (foundRecord) {
        const linksTitle = document.createElement('p');
        linksTitle.className = 'slds-text-heading_small slds-p-bottom_small';
        linksTitle.textContent = 'Esploro Links';
        linksContainer.appendChild(linksTitle);
        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex'; buttonGroup.style.flexWrap = 'wrap'; buttonGroup.style.gap = '0.25rem';
        linksContainer.appendChild(buttonGroup); // Append button group

        // ... (Keep the existing logic for creating and appending buttons to buttonGroup) ...
        if (foundRecord.portalCustomDomain) { const btn = createLinkButton('Portal', foundRecord.portalCustomDomain); if (btn) buttonGroup.appendChild(btn); }
        let almaUrl = null;
        if (foundRecord.directLinkToSqaEnvironment) { /* ... logic to find/create SQA buttons and derive almaUrl ... */
            const urlRegex = /(https?:\/\/[^\s<>"']+)/g; const lines = foundRecord.directLinkToSqaEnvironment.split('\n');
            let sqaLinkCounter = 0; const potentialAlmaSources = [];
            lines.forEach(line => {
                const urls = line.match(urlRegex); if (urls) {
                    urls.forEach(url => {
                        sqaLinkCounter++; const sqaButton = createLinkButton(`SQA Env ${sqaLinkCounter}`, url); if (sqaButton) buttonGroup.appendChild(sqaButton);
                        if (url.includes('productCode=esploro')) {
                            try {
                                let urlObj = new URL(url); if (urlObj.searchParams.get('productCode') === 'esploro') {
                                    urlObj.searchParams.delete('productCode'); let tempAlmaUrl = urlObj.toString();
                                    let isPrimary = urlObj.hostname.startsWith('sqa-') && !urlObj.hostname.match(/sqa\d+/i);
                                    potentialAlmaSources.push({ url: url, almaUrl: tempAlmaUrl, isPrimary: isPrimary });
                                }
                            } catch (e) { console.warn('Could not parse SQA URL:', url, e); }
                        }
                    });
                }
            });
            almaUrl = potentialAlmaSources.find(s => s.isPrimary)?.almaUrl || potentialAlmaSources[0]?.almaUrl;
        }
        if (almaUrl) { const btn = createLinkButton('Alma', almaUrl); if (btn) buttonGroup.appendChild(btn); }
        if (foundRecord.sqaPortalLink) { const btn = createLinkButton('SQA Portal', foundRecord.sqaPortalLink); if (btn) buttonGroup.appendChild(btn); }
        if (foundRecord.otbDomain) { const btn = createLinkButton('OTB Domain', foundRecord.otbDomain); if (btn) buttonGroup.appendChild(btn); }

        hasLinks = buttonGroup.childNodes.length > 0;
    }
    // Add the links container to the list if it has content
    if (hasLinks) blocksToAppend.push(linksContainer);


    // --- 7. Populate Regional World Clock Blocks (Unchanged logic, appends to respective containers) ---
    const timezones = [{ label: 'Kuala Lumpur (MYT)', tz: 'Asia/Kuala_Lumpur', region: 'AP' }, { label: 'New Delhi (IST)', tz: 'Asia/Kolkata', region: 'AP' }, { label: 'Tokyo (JST)', tz: 'Asia/Tokyo', region: 'AP' }, { label: 'Sydney (AET)', tz: 'Australia/Sydney', region: 'AP' }, { label: 'Auckland (NZ)', tz: 'Pacific/Auckland', region: 'AP' }, { label: 'London (UK)', tz: 'Europe/London', region: 'EU' }, { label: 'Rome (CET)', tz: 'Europe/Rome', region: 'EU' }, { label: 'Jerusalem (IST)', tz: 'Asia/Jerusalem', region: 'EU' }, { label: 'New York (ET)', tz: 'America/New_York', region: 'NA' }, { label: 'Los Angeles (PT)', tz: 'America/Los_Angeles', region: 'NA' }];
    const now = new Date(); const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' };

    // Add Titles to time containers
    const apTitle = document.createElement('p'); apTitle.className = 'slds-text-heading_small slds-p-bottom_small'; apTitle.textContent = 'Asia Pacific (AP)'; apTimeContainer.appendChild(apTitle);
    const euTitle = document.createElement('p'); euTitle.className = 'slds-text-heading_small slds-p-bottom_small'; euTitle.textContent = 'EMEA (EU)'; euTimeContainer.appendChild(euTitle);
    const naTitle = document.createElement('p'); naTitle.className = 'slds-text-heading_small slds-p-bottom_small'; naTitle.textContent = 'North America (NA)'; naTimeContainer.appendChild(naTitle);

    // ... (Keep the existing logic for formatting and appending timezones to apTimeContainer, euTimeContainer, naTimeContainer) ...
    timezones.forEach(zone => {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone.tz }); const formattedTime = formatter.format(now);
            const zoneDiv = document.createElement('div'); zoneDiv.style.marginBottom = 'var(--lwc-spacingXXSmall, 0.25rem)'; zoneDiv.style.display = 'flex'; zoneDiv.style.justifyContent = 'space-between';
            const labelSpan = document.createElement('span'); labelSpan.className = 'slds-text-title slds-truncate'; labelSpan.textContent = `${zone.label}:`; labelSpan.style.marginRight = 'var(--lwc-spacingXSmall, 0.5rem)'; labelSpan.style.flexShrink = '0';
            const labelLower = zone.label.toLowerCase();
            if (labelLower.includes('kuala lumpur') || labelLower.includes('jerusalem') || labelLower.includes('rome')) labelSpan.style.color = 'var(--lwc-brandAccessible, #0176d3)';
            else if (labelLower.includes('tokyo') || labelLower.includes('los angeles')) labelSpan.style.color = '#ff5d2d';
            zoneDiv.appendChild(labelSpan);
            const timeSpan = document.createElement('span'); timeSpan.className = 'slds-text-body_regular'; timeSpan.style.textAlign = 'right'; timeSpan.textContent = formattedTime;
            try {
                const parts = formatter.formatToParts(now); const tzNamePart = parts.find(part => part.type === 'timeZoneName');
                if (tzNamePart && (tzNamePart.value.includes('DT') || tzNamePart.value.includes('Daylight') || tzNamePart.value.includes('CEST') || tzNamePart.value.includes('BST'))) { timeSpan.style.fontWeight = 'bold'; timeSpan.title = 'Daylight Saving Time likely active'; }
                else { timeSpan.title = 'Standard Time likely active'; }
            } catch (e) { }
            zoneDiv.appendChild(timeSpan);
            if (zone.region === 'AP') { apTimeContainer.appendChild(zoneDiv); apTimeContent = true; }
            else if (zone.region === 'EU') { euTimeContainer.appendChild(zoneDiv); euTimeContent = true; }
            else if (zone.region === 'NA') { naTimeContainer.appendChild(zoneDiv); naTimeContent = true; }
        } catch (e) { /* ... error handling ... */ }
    });

    // Add time containers to the list if they have content
    if (apTimeContent) blocksToAppend.push(apTimeContainer);
    if (euTimeContent) blocksToAppend.push(euTimeContainer);
    if (naTimeContent) blocksToAppend.push(naTimeContainer);

    // --- 8. Append Content Columns to Wrapper ---
    if (blocksToAppend.length > 0) {
        blocksToAppend.forEach(block => esploroWrapper.appendChild(block));

        // --- 9. Highlight Region based on Affected Environment (Unchanged logic) ---
        let affectedRegion = null;
        try { /* ... logic to find affectedRegion ... */
            const envSelectors = ['.test-id__field-label:has(span[title="Affected Environment"]) + .test-id__field-value span lightning-formatted-text', 'records-record-layout-item[field-label="Affected Environment"] lightning-formatted-text', 'div.secondaryFields records-highlights-details-item:has(p[title="Affected Environment"]) p.fieldComponent lightning-formatted-text', 'span[title="Affected Environment"] + * .forceOutputLookup', 'span[title="Affected Environment"] ~ * .slds-form-element__static',];
            let envText = null; for (const selector of envSelectors) { const element = document.querySelector(selector); if (element) { envText = element.textContent.trim().toUpperCase(); console.log(`Found Affected Environment Text with selector "${selector}":`, envText); break; } }
            if (envText) { if (envText.includes(' NA')) affectedRegion = 'NA'; else if (envText.includes(' EU')) affectedRegion = 'EU'; else if (envText.includes(' AP') || envText.includes(' CN')) affectedRegion = 'AP'; else console.warn('Could not determine region:', envText); }
            else { console.warn('Could not find Affected Environment element.'); }
        } catch (e) { console.error('Error finding/parsing Affected Environment:', e); }
        if (affectedRegion) {
            const regionDivId = `esploro-${affectedRegion.toLowerCase()}-times`;
            const regionDivToHighlight = esploroWrapper.querySelector(`#${regionDivId}`);
            if (regionDivToHighlight) {
                regionDivToHighlight.style.border = '2px solid #0176d3';
                regionDivToHighlight.style.borderRadius = 'var(--lwc-borderRadiusMedium, 0.25rem)';
                // Adjust margin/padding slightly to account for border width
                regionDivToHighlight.style.margin = 'calc(var(--lwc-spacingXXSmall, 0.25rem) - 1px)'; // Adjust based on base margin/padding
                regionDivToHighlight.style.padding = 'calc(var(--lwc-spacingXSmall, 0.5rem) - 1px)';
                console.log(`Applied highlight to ${regionDivId}`);
            } else { console.warn(`Could not find div with ID ${regionDivId} to highlight.`); }
        }

        // --- 10. Final Append and Styling ---
        esploroWrapper.style.height = 'auto';
        esploroWrapper.style.overflowX = 'auto'; // Horizontal scroll if needed
        // Apply min-height for some consistency
        blocksToAppend.forEach(box => { box.style.minHeight = '150px'; box.style.height = 'auto'; });

        parentContainer.appendChild(esploroWrapper);
        console.log('Successfully added Esploro content blocks (inline details).');
    } else {
        console.log('No Esploro content generated to display.');
    }
}

// Case Comment Extractor Helpers
function extractCaseComments() {
    console.log("Attempting to extract case comments...");
    let caseId = "";
    let caseNumber = "";
    const metadata = {};

    // --- Extract Case ID --- (From URL or title)
    const urlMatch = window.location.pathname.match(
        /\/(?:Case|lightning\/r\/Case)\/([a-zA-Z0-9]{15,18})\//i
    );
    if (urlMatch && urlMatch[1]) {
        caseId = urlMatch[1];
    }
    metadata.caseId = caseId || "N/A";
    console.log("Case ID:", metadata.caseId);    // --- Extract Case Number --- (From formatted text element or page title)
    const caseNumberElement = document.querySelector(
        'lightning-formatted-text[data-output-element-id="output-field"][slot="output"]'
    );
    if (caseNumberElement) {
        caseNumber = caseNumberElement.textContent.trim();
    }
    // Fallback: Try to extract from page title if element not found or value is empty
    if (!caseNumber) {
        const titleElement = document.querySelector('title');
        if (titleElement) {
            const titleText = titleElement.textContent.trim();
            // Extract first 8 characters from title if it matches the expected pattern
            if (titleText && /^\d{8}/.test(titleText)) {
                caseNumber = titleText.substring(0, 8);
                console.log("Case number extracted from title:", caseNumber);
            }
        }
    }
    metadata.caseNumber = caseNumber || "N/A";
    console.log("Case Number:", metadata.caseNumber);

    // --- Extract Metadata ---
    console.log("Extracting metadata...");
    // Extract subject
    const subjectElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Subject"] lightning-formatted-text[slot="outputField"]');
    metadata.subject = subjectElement ? subjectElement.textContent.trim() : "N/A";
    
    // Extract description
    const descriptionElement = document.querySelector('div[data-target-selection-name="sfdc:RecordField.Case.Description"] lightning-formatted-text[slot="outputField"]');
    metadata.description = descriptionElement ? descriptionElement.textContent.trim() : "N/A";

    const metadataFields = {
        Priority: "priority",
        Status: "status",
        "Contact Name": "contactName",
        "Account Name": "accountName",
    };

    // Extract other metadata fields
    document
        .querySelectorAll("records-record-layout-item, div.forcePageBlockItem")
        .forEach((item) => {
            // Added PageBlockItem
            const labelElement = item.querySelector(
                ".slds-form-element__label, .test-id__field-label, label"
            ); // Added label tag
            if (labelElement) {
                const labelText = labelElement.textContent.trim();
                if (metadataFields[labelText]) {
                    const valueElement = item.querySelector(
                        ".slds-form-element__static lightning-formatted-text, " +
                        ".slds-form-element__control output lightning-formatted-text, " +
                        ".forceOutputLookup a span, .forceOutputLookup a, " + // Added direct link
                        ".forceOutputPicklist span, " +
                        "lightning-formatted-date-time, " +
                        "lightning-formatted-rich-text span, " +
                        ".test-id__field-value span, .test-id__field-value a, " +
                        "span.uiOutputText" // Added basic span output
                    );
                    if (valueElement) {
                        let value = valueElement.textContent.trim();
                        if (labelText === "Contact Name" || labelText === "Account Name") {
                            // More robust cleaning for lookup names
                            if (value.startsWith("Open ") && value.includes(" Preview")) {
                                value = value
                                    .substring(
                                        value.indexOf(" ") + 1,
                                        value.lastIndexOf(" Preview")
                                    )
                                    .trim();
                            } else if (
                                valueElement.tagName === "A" &&
                                valueElement.hasAttribute("title")
                            ) {
                                value = valueElement.getAttribute("title"); // Get name from title attribute if link text is generic
                            }
                        }
                        metadata[metadataFields[labelText]] = value;
                    } else {
                        metadata[metadataFields[labelText]] = ""; // Assign empty if value not found
                    }
                }
            }
        });
    console.log("Metadata extracted:", metadata);

    // --- Find Comments Table/Related List ---
    const commentsContainerSelectors = [
        'article.slds-card[title*="Case Comments"]', // Lightning card
        'div.forceRelatedListContainer[title*="Case Comments"]', // Related list view
        'div[aria-label*="Case Comments"]', // Aria label fallback
        "#CaseComments_body", // ID used in Classic?
        '.related_list_container[id*="CaseComments"]', // Another potential related list ID pattern
    ];
    let commentsContainer = null;
    for (const selector of commentsContainerSelectors) {
        commentsContainer = document.querySelector(selector);
        if (commentsContainer) {
            console.log("Comments container found with selector:", selector);
            break;
        }
    }
    if (!commentsContainer) {
        console.error("Case Comments container not found.");
        showToast("Could not find Case Comments related list/card.", "error");
        return null;
    }

    const commentsTable = commentsContainer.querySelector(
        "table.slds-table, table.list"
    ); // Added classic table class
    if (!commentsTable) {
        console.warn(
            "Case Comments table not found within the container. Might be empty or using different structure."
        );
        return { caseNumber, metadata, comments: [] }; // Return empty comments if table isn't there
    }
    console.log("Comments table found:", commentsTable);

    // --- Extract Comments ---
    const comments = [];
    const rows = commentsTable.querySelectorAll("tbody tr");
    console.log(`Found ${rows.length} comment rows.`);

    rows.forEach((row, index) => {
        const getCellText = (label, cellIndex) => {
            // Prioritize data-label, then th/td by index
            const cell =
                row.querySelector(
                    `th[data-label="${label}"], td[data-label="${label}"]`
                ) || row.cells[cellIndex];
            if (!cell) return "N/A";
            // Try specific inner elements first
            const innerElement = cell.querySelector(
                "a, span, lightning-formatted-text, lightning-formatted-date-time, lightning-formatted-rich-text span, div.feedBodyInner"
            ); // Added feedBodyInner
            return (
                innerElement?.textContent?.trim() || cell?.textContent?.trim() || "N/A"
            );
        };
        const getPublicStatus = () => {
            // Look for checkbox or image indicating public status
            const cell =
                row.querySelector('th[data-label="Public"], td[data-label="Public"]') ||
                row.cells[2]; // Adjust index if needed
            if (!cell) return "No";
            const img = cell.querySelector("img");
            if (img) {
                const title = img.getAttribute("title")?.toLowerCase();
                const alt = img.getAttribute("alt")?.toLowerCase();
                return title === "true" ||
                    title === "checked" ||
                    alt === "true" ||
                    alt === "checked"
                    ? "Yes"
                    : "No";
            }
            const checkbox = cell.querySelector('input[type="checkbox"]');
            if (checkbox) {
                return checkbox.checked ? "Yes" : "No";
            }
            // Fallback check for text content (less reliable)
            return cell.textContent.trim().toLowerCase() === "true" ? "Yes" : "No";
        };
        // Adjust indices/labels based on actual table structure
        const author = getCellText("Created By", 1);
        const isPublic = getPublicStatus(); // Use refined function
        const date = getCellText("Created Date", 3);
        const commentText = getCellText("Comment Body", 4);

        comments.push({ author, isPublic, date, commentText });
    });

    if (comments.length === 0 && rows.length > 0) {
        console.warn(
            "Found comment rows but failed to extract data. Check selectors within rows."
        );
    } else if (comments.length === 0) {
        console.warn("No comment rows found or extracted from the table body.");
    }

    return { caseNumber, metadata, comments };
}
function formatCommentDate(dateStr) {
    if (!dateStr || dateStr === "N/A") return "N/A";
    try {
        // Attempt standard parsing first (handles MM/DD/YYYY, HH:MM AM/PM well in most browsers)
        let date = new Date(dateStr.replace(",", "")); // Remove comma often found

        // Check if standard parsing worked
        if (isNaN(date.getTime())) {
            // Attempt parsing DD/MM/YYYY HH:MM (24hr)
            const parts24 = dateStr.match(
                /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/
            );
            if (parts24) {
                const d = parseInt(parts24[1], 10);
                const m = parseInt(parts24[2], 10);
                const y = parseInt(parts24[3], 10);
                const hh = parseInt(parts24[4], 10);
                const mm = parseInt(parts24[5], 10);
                date = new Date(y, m - 1, d, hh, mm); // Month is 0-indexed
            } else {
                // Attempt parsing DD/MM/YYYY HH:MM AM/PM (less common but possible)
                const parts12 = dateStr.match(
                    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i
                );
                if (parts12) {
                    const d = parseInt(parts12[1], 10);
                    const m = parseInt(parts12[2], 10);
                    const y = parseInt(parts12[3], 10);
                    let hh = parseInt(parts12[4], 10);
                    const mm = parseInt(parts12[5], 10);
                    const ampm = parts12[6].toUpperCase();
                    if (ampm === "PM" && hh < 12) hh += 12;
                    if (ampm === "AM" && hh === 12) hh = 0; // Midnight case
                    date = new Date(y, m - 1, d, hh, mm);
                }
            }
        }

        if (isNaN(date?.getTime())) {
            // Final check if any parsing worked
            console.warn(`Could not parse date: "${dateStr}". Returning original.`);
            return dateStr;
        }

        // Format to DD/MM/YYYY HH:MM (24hr format)
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
        console.error(`Error formatting date "${dateStr}":`, e);
        return dateStr; // Return original on error
    }
}
function generateXML(data) {
    if (!data || !data.comments) return "<error>No data extracted</error>";
    const getMeta = (key) => data.metadata?.[key] || ""; // Default to empty string
    const escape = escapeXML; // Alias for brevity

    let xml = "<case>\n";
    xml += "  <metadata>\n";
    xml += `    <caseId>${escape(getMeta("caseId"))}</caseId>\n`;
    xml += `    <caseNumber>${escape(getMeta("caseNumber"))}</caseNumber>\n`;
    xml += `    <subject>${escape(getMeta("subject"))}</subject>\n`;
    xml += `    <description>${escape(getMeta("description"))}</description>\n`;
    xml += `    <priority>${escape(getMeta("priority"))}</priority>\n`;
    xml += `    <status>${escape(getMeta("status"))}</status>\n`;
    xml += `    <contactName>${escape(getMeta("contactName"))}</contactName>\n`;
    xml += `    <accountName>${escape(getMeta("accountName"))}</accountName>\n`;
    xml += "  </metadata>\n";
    xml += "  <updates>\n";
    // Sort comments by date (ascending) before adding to XML
    const sortedComments = [...data.comments].sort((a, b) => {
        try {
            // Attempt to parse formatted dates back to Date objects for comparison
            const parseFormattedDate = (formattedStr) => {
                if (!formattedStr || formattedStr === "N/A") return null;
                const parts = formattedStr.match(
                    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
                );
                if (!parts) return null;
                // year, month-1, day, hour, minute
                return new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5]);
            };
            const dateA = parseFormattedDate(formatCommentDate(a.date));
            const dateB = parseFormattedDate(formatCommentDate(b.date));
            if (dateA && dateB) return dateA - dateB;
            if (dateA) return -1; // Place valid dates first
            if (dateB) return 1;
            return 0; // Keep original order if both dates are invalid/unparseable
        } catch (e) {
            return 0; // Keep original order on comparison error
        }
    });

    sortedComments.forEach((comment) => {
        xml += `    <comment public="${comment.isPublic === "Yes" ? "true" : "false"
            }">\n`;
        xml += `      <author>${escape(comment.author)}</author>\n`;
        xml += `      <date>${escape(formatCommentDate(comment.date))}</date>\n`; // Format date
        xml += `      <text>${escape(comment.commentText)}</text>\n`;
        xml += "    </comment>\n";
    });
    xml += "  </updates>\n</case>";
    return xml;
}
function generateTable(data) {
    if (!data || !data.comments) return "No data available";
    const getMeta = (key) => data.metadata?.[key] || "N/A";

    let table = `Case ID:\t${getMeta("caseId")}\n`; // Add Case ID
    table += `Case Number:\t${getMeta("caseNumber")}\n`; // Use Tab for separation
    table += `Subject:\t${getMeta("subject")}\n`;
    table += `Description:\t${getMeta("description")}\n`;
    table += `Contact:\t${getMeta("contactName")}\n`;
    table += `Account:\t${getMeta("accountName")}\n`;
    table += `Status:\t${getMeta("status")}\n`; // Add status
    table += "\n";
    table += "Author\tPublic\tDate\tComment\n"; // TSV Header

    // Sort comments by date (ascending)
    const sortedComments = [...data.comments].sort((a, b) => {
        try {
            const parseFormattedDate = (formattedStr) => {
                if (!formattedStr || formattedStr === "N/A") return null;
                const parts = formattedStr.match(
                    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
                );
                if (!parts) return null;
                return new Date(parts[3], parts[2] - 1, parts[1], parts[4], parts[5]);
            };
            const dateA = parseFormattedDate(formatCommentDate(a.date));
            const dateB = parseFormattedDate(formatCommentDate(b.date));
            if (dateA && dateB) return dateA - dateB;
            if (dateA) return -1;
            if (dateB) return 1;
            return 0;
        } catch (e) {
            return 0;
        }
    });

    sortedComments.forEach((comment) => {
        const escapedComment = (comment.commentText || "")
            .replace(/\t/g, " ")
            .replace(/\n/g, " ");
        const formattedDate = formatCommentDate(comment.date);
        table += `${comment.author || "N/A"}\t${comment.isPublic
            }\t${formattedDate}\t${escapedComment}\n`;
    });
    return table;
}
function escapeXML(str) {
    if (typeof str !== "string") return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
async function copyToClipboard(text) {
    try {
        // Try the modern Clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            console.log("Text copied using navigator.clipboard");
            return true;
        } else {
            // Fallback using document.execCommand
            console.log("Attempting fallback copy...");
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0"; // Hide it
            document.body.appendChild(textArea);
            textArea.select();
            const successful = document.execCommand("copy");
            document.body.removeChild(textArea);
            if (successful) {
                console.log("Fallback copy successful");
                return true;
            } else {
                console.error("Fallback copy failed");
                return false;
            }
        }
    } catch (err) {
        console.error("Failed to copy text:", err);
        return false;
    }
}
function showToast(message, type = "success") {
    console.log(`Toast (${type}): ${message}`);
    // Try using Salesforce native toast first
    if (typeof $A !== "undefined" && $A.get) {
        // Check for Aura context
        try {
            const toastEvent = $A.get("e.force:showToast");
            if (toastEvent) {
                toastEvent.setParams({
                    title: type.charAt(0).toUpperCase() + type.slice(1),
                    message: message,
                    type: type, // 'success', 'error', 'warning', 'info'
                    mode: type === "error" ? "sticky" : "dismissible",
                });
                toastEvent.fire();
                console.log("Native Salesforce toast fired.");
                return;
            }
        } catch (e) {
            console.error("Error firing native Salesforce toast:", e);
        }
    }

    // Custom fallback toast
    const toastId = `custom-toast-${Date.now()}`;
    const toast = document.createElement("div");
    toast.id = toastId;
    Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        padding: "12px 20px",
        borderRadius: "4px",
        color: "white",
        zIndex: "9999",
        fontSize: "14px",
        maxWidth: "350px",
        boxShadow: "0 3px 6px rgba(0,0,0,0.16)",
        opacity: "1",
        transition: "opacity 0.5s ease-out",
    });
    switch (type) {
        case "success":
            toast.style.backgroundColor = "#4CAF50";
            break;
        case "error":
            toast.style.backgroundColor = "#F44336";
            break;
        case "warning":
            toast.style.backgroundColor = "#FFC107";
            break;
        default:
            toast.style.backgroundColor = "#2196F3";
    }
    toast.textContent = message;
    document.body.appendChild(toast);
    console.log("Displayed custom fallback toast.");
    setTimeout(() => {
        const el = document.getElementById(toastId);
        if (el) {
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 500); // Remove after fade
        }
    }, 3500);
}
function addCopyButtons(actionContainer) {
    if (!actionContainer || actionContainer.querySelector('[data-cc-extractor="true"]')) {
        return; // Don't add if container missing or buttons already exist
    }
    console.log("Adding copy buttons to:", actionContainer);

    const createButton = (text, title) => {
        const li = document.createElement("li");
        li.className = "slds-button slds-button--neutral slds-button_neutral";
        li.setAttribute("data-cc-extractor", "true");
        
        const a = document.createElement("a");
        a.href = "javascript:void(0);";
        a.title = title;
        a.className = "forceActionLink";
        a.setAttribute("role", "button");
        
        const div = document.createElement("div");
        div.title = title;
        div.textContent = text;
        
        a.appendChild(div);
        li.appendChild(a);
        return li;
    };

    // Create buttons
    const copyTableButton = createButton("Copy Table", "Copy comments as TSV");
    copyTableButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = extractCaseComments();
        if (data && data.comments.length > 0) {
            const tableText = generateTable(data);
            const success = await copyToClipboard(tableText);
            showToast(success ? "Table copied" : "Copy failed", success ? "success" : "error");
        } else {
            showToast(data ? "No comments found" : "Extraction failed", "warning");
        }
    });

    const copyXMLButton = createButton("Copy XML", "Copy comments as XML");
    copyXMLButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const data = extractCaseComments();
        if (data && data.comments.length > 0) {
            const xmlText = generateXML(data);
            const success = await copyToClipboard(xmlText);
            showToast(success ? "XML copied" : "Copy failed", success ? "success" : "error");
        } else {
            showToast(data ? "No comments found" : "Extraction failed", "warning");
        }
    });

    // Append buttons after the "New" button
    actionContainer.appendChild(copyTableButton);
    actionContainer.appendChild(copyXMLButton);
    console.log("Copy buttons added to action container.");
}

// Vital Fields Display Helpers
const VITAL_FIELDS_SECTION_ID = "vital-fields-jira-section";
const ORANGE_HIGHLIGHT = "rgb(247, 114, 56)";
const GREY_HIGHLIGHT = "rgb(103, 103, 103)";
const PAGE_FIELD_HIGHLIGHT = "rgb(255, 232, 184)"; // Light orange

function getFieldValueByLabel(labelText) {
    // Use more robust selectors
    const selectors = [
        `.test-id__field-label:has(span[title="${labelText}"]) + .test-id__field-value`, // LWC Test ID structure
        `records-record-layout-item[field-label="${labelText}"] slot[name="outputField"]`, // Standard LWC Layout Item
        // Add specific selectors for known fields if the general ones fail
    ];
    let value = "";
    let parentElement = null; // The element containing label and value
    let valueElement = null; // The specific element with the value text/link

    for (const selector of selectors) {
        parentElement = document.querySelector(selector);
        if (parentElement) {
            // Now find the value *within* this parent element
            valueElement = parentElement.querySelector(
                "lightning-formatted-text, lightning-formatted-url, lightning-formatted-date-time, " +
                "lightning-formatted-rich-text span, lightning-formatted-picklist span, " + // Picklist
                'a[data-refid="recordId"], a[data-refid]:not([data-refid="recordId"]), ' + // Lookups (prioritize recordId link)
                "span.uiOutputText, span.test-id__field-value>span" // Other span types
            );
            // Handle checkbox specifically (for Escalation)
            if (!valueElement && labelText === "Escalation") {
                const checkbox = parentElement.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    value = checkbox.checked ? "Yes" : "No";
                    break; // Found value
                }
            }
            // Handle JIRA Support Action Required (might be picklist)
            if (!valueElement && labelText === "JIRA Support Action Required") {
                const picklistSpan = parentElement.querySelector(
                    "lightning-formatted-picklist span"
                );
                if (picklistSpan) valueElement = picklistSpan;
            }

            if (valueElement) {
                // Special handling for lookups - try to get the title or text
                if (valueElement.tagName === "A") {
                    value = valueElement.title || valueElement.textContent.trim();
                    // Clean up typical Salesforce link text like "Open ... Preview"
                    if (value.startsWith("Open ") && value.includes(" Preview")) {
                        value = value
                            .substring(value.indexOf(" ") + 1, value.lastIndexOf(" Preview"))
                            .trim();
                    }
                } else {
                    value = valueElement.textContent.trim();
                }
                break; // Found the value element
            }
        }
    }

    // If still no value, try finding label and then getting sibling/parent value (more fragile)
    if (!value && !parentElement) {
        const labels = document.querySelectorAll(
            ".slds-form-element__label, .test-id__field-label, label"
        );
        for (const labelElement of labels) {
            if (labelElement.textContent.trim() === labelText) {
                parentElement = labelElement.closest(
                    "records-record-layout-item, .forcePageBlockItem, .slds-form-element"
                );
                if (parentElement) {
                    // Repeat value finding logic within this parent
                    valueElement = parentElement.querySelector(
                        `.test-id__field-label:has(span[title="${labelText}"]) + .test-id__field-value`
                    );
                    if (valueElement) {
                        value = valueElement.textContent.trim();
                        break;
                    }
                }
            }
        }
    }

    return { value: value || "", element: parentElement }; // Return parent for highlighting
}
async function injectVitalFieldsAndJiraSection(pathAssistantContainer) {
    if (!featureSettings?.vitalFieldsDisplay) return; // Check feature flag
    console.log("Injecting Vital Fields & JIRA section...");

    // --- 1. Extract Data ---
    const fieldsToExtract = [
        "Category",
        "Sub-Category",
        "Status",
        "Sub-Status",
        "Analysis Note",
        "Problem (Root Cause)",
        "Parent Case",
        "Escalation",
        "JIRA Support Action Required",
        "JIRA Status",
        "Primary JIRA",
        "Jira Type",
        "Jira Resolution",
        "Fix Version Release Date",
        "Platform / Service",
    ];
    const extractedData = {};
    const fieldElements = {};
    fieldsToExtract.forEach((label) => {
        const result = getFieldValueByLabel(label);
        extractedData[label] = result.value;
        fieldElements[label] = result.element;
    });

    // --- 2. Determine Neutralization & Prepare Vital Fields ---
    const vitalFieldsData = [];
    const fieldsToHighlight = [];
    const checkNeutralization = (label, value) => {
        /* ... same logic as before ... */
        let isNeutral = true;
        switch (label) {
            case "Category":
            case "Sub-Category":
            case "Status":

            case "Sub-Status":
            case "Analysis Note":
            case "Problem (Root Cause)":
                       case "Platform / Service":
                isNeutral = !!value && value !== "N/A"; // Neutral if populated and not 'N/A'
                break;
            case "Parent Case":
            case "Escalation":
                isNeutral = !value || value === "No" || value === "N/A"; // Neutral if empty or explicitly 'No'/'N/A'
                break;
            case "JIRA Support Action Required":
                isNeutral = value?.toLowerCase() !== "yes"; // Neutral if not 'Yes'
                break;
            case "JIRA Status":
                isNeutral = !value?.toLowerCase().includes("input"); // Neutral if doesn't contain 'input'
                break;
            default:
                isNeutral = true;
        }
        if (!isNeutral) fieldsToHighlight.push(label);
        return isNeutral;
    };
    const vitalFieldLabels = [
        "Category",
        "Sub-Category",
        "Status",
        "Sub-Status",
        "Analysis Note",
        "Problem (Root Cause)",
        "Parent Case",
        "Escalation",
        "JIRA Support Action Required",
        "JIRA Status",
        "Platform / Service",
    ];
    vitalFieldLabels.forEach((label) => {
        const value = extractedData[label];
        let shouldShow = true; // Determine if field should be shown
        if (label === "Parent Case" && (!value || value === "N/A"))
            shouldShow = false;
        if (label === "Escalation" && (!value || value === "No" || value === "N/A"))
            shouldShow = false;
        if (
            label === "JIRA Support Action Required" &&
            value?.toLowerCase() !== "yes"
        )
            shouldShow = false;
        if (
            label === "JIRA Status" &&
            (!value || !value.toLowerCase().includes("input") || value === "N/A")
        )
            shouldShow = false;

        if (shouldShow) {
            vitalFieldsData.push({
                label: label,
                value: value || "(empty)",
                isNeutral: checkNeutralization(label, value),
            });
        }
    });

    // --- 3. Build HTML ---
    const sectionArticle = document.createElement("article");
    sectionArticle.id = VITAL_FIELDS_SECTION_ID;
    sectionArticle.className = "slds-card vital-fields-card";
    sectionArticle.style.marginTop = "1rem";
    const cardBody = document.createElement("div");
    cardBody.className = "slds-card__body slds-card__body_inner";
    const toggleButton = document.createElement("button");
    toggleButton.className =
        "slds-button slds-button_icon slds-button_icon-border-filled slds-path__trigger vital-toggle-button";
    toggleButton.title = "Show Details";
    toggleButton.setAttribute("aria-expanded", "true");
    toggleButton.setAttribute(
        "aria-controls",
        `${VITAL_FIELDS_SECTION_ID}-content`
    );
    toggleButton.style.backgroundColor = "transparent";
    // SVG for chevron (ensure correct SVG path)
    toggleButton.innerHTML = `<lightning-primitive-icon><svg focusable="false" data-key="chevronright" aria-hidden="false" viewBox="0 0 520 520" class="slds-button__icon slds-icon-utility-chevronright slds-icon_x-small"><g><path d="M179 44l207 205c6 6 6 16 0 22L179 476c-6 6-16 6-22 0l-22-22c-6-6-6-16 0-22l163-161c6-6 6-16 0-22L136 88c-6-6-6-16 0-22l22-22c6-5 15-5 21 0z"></path></g></svg></lightning-primitive-icon><span class="slds-assistive-text">Show Details</span>`;
    const contentDiv = document.createElement("div");
    contentDiv.id = `${VITAL_FIELDS_SECTION_ID}-content`;
    contentDiv.className = "vital-fields-content";
    contentDiv.style.paddingLeft = "0";

    // Vital Fields Section
    const vitalSection = document.createElement("section");
    vitalSection.className = "slds-path__keys";
    vitalSection.innerHTML = `<h2 class="title slds-path__coach-title" style="margin-bottom: 0.5rem;">Vital Fields</h2>`;
    const vitalFieldsContainer = document.createElement("div");
    vitalFieldsContainer.style.display = "flex";
    vitalFieldsContainer.style.flexWrap = "wrap";
    vitalFieldsContainer.style.gap = "0.5rem";
    vitalFieldsData.forEach((field) => {
        const fieldSpan = document.createElement("span");
        fieldSpan.className = "slds-truncate";
        Object.assign(fieldSpan.style, {
            backgroundColor: field.isNeutral ? GREY_HIGHLIGHT : ORANGE_HIGHLIGHT,
            borderRadius: "6px",
            padding: "3px 6px",
            color: "white",
            fontWeight: "500",
            display: "inline-block",
        });
        fieldSpan.textContent = field.label;
        fieldSpan.title = `${field.label}: ${field.value}`;
        if (field.label === "Analysis Note") {
            // Special handling for Analysis Note
            fieldSpan.style.whiteSpace = "normal";
            fieldSpan.classList.remove("slds-truncate");
            fieldSpan.textContent = `${field.label}: ${field.value}`;
            fieldSpan.title = "Analysis Note";
        }
        vitalFieldsContainer.appendChild(fieldSpan);
    });
    vitalSection.appendChild(vitalFieldsContainer);
    contentDiv.appendChild(vitalSection);

    // JIRA Section
    const jiraSection = document.createElement("section");
    jiraSection.className = "slds-path__guidance pa-guidance";
    jiraSection.style.marginTop = "1rem";
    jiraSection.innerHTML = `<h2 class="slds-path__coach-title" style="margin-bottom: 0.5rem;">JIRA / Esploro</h2>`;
    jiraSection.style.backgroundColor = "transparent";
    const jiraContentContainer = document.createElement("div");
    jiraContentContainer.style.display = "flex";
    jiraContentContainer.style.flexWrap = "wrap";
    jiraContentContainer.style.gap = "0 1rem";
    const primaryJiraId = extractedData["Primary JIRA"];
    if ((primaryJiraId && primaryJiraId !== "N/A") || extractedData["JIRA ID"]) {
        // JIRA Exists
        const jiraFieldsToShow = [
            { label: "JIRA ID", value: primaryJiraId },
            { label: "Jira Type", value: extractedData["Jira Type"] },
            { label: "JIRA Status", value: extractedData["JIRA Status"] },
            { label: "JIRA Resolution", value: extractedData["Jira Resolution"] },
            {
                label: "Fix Version Release Date",
                value: extractedData["Fix Version Release Date"],
            },
        ];
        jiraFieldsToShow.forEach((field) => {
            const itemDiv = document.createElement("div");
            itemDiv.style.marginBottom = "0.5rem";
            itemDiv.style.flex = "1 1 30%";
            itemDiv.innerHTML = `<p class="slds-text-title slds-truncate" title="${field.label
                }">${field.label
                }</p><p class="slds-text-body--regular slds-truncate">${escapeXML(
                    field.value || "N/A"
                )}</p>`;
            jiraContentContainer.appendChild(itemDiv);
        });
        const linkDiv = document.createElement("div");
        linkDiv.style.flexBasis = "100%";
        linkDiv.style.marginTop = "0.5rem";
        const jiraLink = document.createElement("a");
        jiraLink.href = `https://jira.clarivate.io/browse/${primaryJiraId}`; // Correct base URL?
        jiraLink.target = "_blank";
        jiraLink.rel = "noopener noreferrer";
        jiraLink.innerHTML = `<span class="slds-button slds-button_outline-brand">View JIRA: ${primaryJiraId}</span>`;
        linkDiv.appendChild(jiraLink);
        jiraContentContainer.appendChild(linkDiv);
    } else if (featureSettings?.esploroDataDisplay) {
        // No JIRA, but Esploro display is ON
        try {
            const esploroDetails = await getEsploroDetailsForVitalFields();
            if (esploroDetails) {
                Object.entries(esploroDetails).forEach(([label, value]) => {
                    const itemDiv = document.createElement("div");
                    itemDiv.style.marginBottom = "0.5rem";
                    itemDiv.style.flex = "1 1 30%";
                    itemDiv.innerHTML = `<p class="slds-text-title slds-truncate" title="${label}">${label}</p><p class="slds-text-body--regular slds-truncate">${escapeXML(
                        value || "N/A"
                    )}</p>`;
                    jiraContentContainer.appendChild(itemDiv);
                });
            } else {
                jiraContentContainer.innerHTML =
                    '<p class="slds-text-body--regular"><i>No JIRA. Esploro details not found for this account.</i></p>';
            }
        } catch (error) {
            console.error(
                "Error fetching Esploro details for Vital Fields section:",
                error
            );
            jiraContentContainer.innerHTML =
                '<p class="slds-text-body--regular"><i>Error fetching Esploro details.</i></p>';
        }
    } else {
        // No JIRA and Esploro display OFF
        jiraContentContainer.innerHTML =
            '<p class="slds-text-body--regular"><i>No JIRA submitted for the case.</i></p>';
    }
    jiraSection.appendChild(jiraContentContainer);
    contentDiv.appendChild(jiraSection);

    // --- Assemble Card ---
    const headerDiv = document.createElement("div");
    headerDiv.style.display = "flex";
    headerDiv.appendChild(toggleButton);
    cardBody.appendChild(headerDiv);
    cardBody.appendChild(contentDiv);
    sectionArticle.appendChild(cardBody);

    // --- 4. Inject Section ---
    pathAssistantContainer.insertAdjacentElement("afterend", sectionArticle);
    console.log("Vital Fields & JIRA section injected.");

    // --- 5. Add Toggle Listener ---
    toggleButton.addEventListener("click", () => {
        const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";
        toggleButton.setAttribute("aria-expanded", !isExpanded);
        toggleButton.title = isExpanded ? "Show Details" : "Hide Details";
        contentDiv.classList.toggle("slds-hide", isExpanded);
        // Toggle chevron direction (simple class toggle might work depending on LWC internals)
        const icon = toggleButton.querySelector("svg");
        if (icon)
            icon.style.transform = isExpanded ? "rotate(0deg)" : "rotate(90deg)"; // Basic rotation
        const assistiveText = toggleButton.querySelector(".slds-assistive-text");
        if (assistiveText)
            assistiveText.textContent = isExpanded ? "Show Details" : "Hide Details";
    });

    // --- 6. Highlight Original Fields ---
    clearVitalFieldHighlights();
    fieldsToHighlight.forEach((label) => {
        const fieldElement = fieldElements[label];
        if (fieldElement) {
            // Highlight the value part or the whole container
            const valueContainer =
                fieldElement.querySelector(".slds-form-element__control") ||
                fieldElement; // Target control or fallback to parent
            valueContainer.style.backgroundColor = PAGE_FIELD_HIGHLIGHT;
            valueContainer.setAttribute("data-vital-field-highlighted", "true");
        }
    });
}
async function getEsploroDetailsForVitalFields() {
    // Re-extract account name/number here as they might change dynamically
    let accountName = getFieldValueByLabel("Account Name").value;
    let exLibrisAccountNumber = getFieldValueByLabel(
        "Ex Libris Account Number"
    ).value?.replace(/-/g, "_");

    let foundRecord = null;
    if (
        (accountName || exLibrisAccountNumber) &&
        Array.isArray(esploroData) &&
        esploroData.length > 0
    ) {
        foundRecord = esploroData.find(
            (record) =>
                (exLibrisAccountNumber &&
                    record.institutionCode &&
                    exLibrisAccountNumber.toLowerCase() ===
                    record.institutionCode.replace(/-/g, "_").toLowerCase()) ||
                (accountName &&
                    record.name &&
                    accountName.toLowerCase() === record.name.toLowerCase())
        );
    }
    if (foundRecord) {
        return {
            "Inst Code": foundRecord.institutionCode,
            Server: foundRecord.server,
            CustID: foundRecord.custID,
            InstID: foundRecord.instID,
            Prefix: foundRecord.prefix,
            Edition: foundRecord.esploroEdition,
        };
    }
    return null;
}
async function updateVitalFieldsAndJiraSection() {
    if (!featureSettings?.vitalFieldsDisplay) return; // Check flag
    const section = document.getElementById(VITAL_FIELDS_SECTION_ID);
    if (!section) return; // Section doesn't exist to update

    console.log("Updating Vital Fields & JIRA section content...");
    // Find the path assistant container again to ensure it's still valid
    const pathAssistantArticle = document.querySelector(
        "article.slds-card .slds-path"
    );
    if (pathAssistantArticle) {
        const container = pathAssistantArticle.closest("article.slds-card");
        if (container) {
            removeVitalFieldsSection(); // Remove the old one first
            await injectVitalFieldsAndJiraSection(container); // Re-inject with potentially fresh data
        } else {
            console.warn(
                "Could not find path assistant container article to update vital fields."
            );
        }
    } else {
        console.warn("Path assistant element not found during update.");
    }
}

function whyNot() {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeContentScript);
    } else {
        initializeContentScript();
    }
    // Cleanup observer on page unload
    window.addEventListener("unload", () => {
        console.log("Cleanup on unload.");
    });
};

whyNot();