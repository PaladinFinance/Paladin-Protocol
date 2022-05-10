const { ethers } = require("hardhat");

// Addresses for all_deploy :

const TOKENS = {
    COMP: "0x61460874a7196d6a22D1eE4922473664b3E95270",
    AAVE: "0xB597cd8D3217ea6477232F9217fa70837ff667Af",
    STKAAVE: "0xf2fbf9A6710AfDa1c4AaB2E922DE9D69E0C97fd2",
    UNI: "0x075A36BA8846C6B6F53644fDd3bf17E5151789DC",
    IDLE: "0xAB6Bdb5CCF38ECDa7A92d04E86f7c53Eb72833dF",
    INDEX: "0x11Bbf860cC91205aF880F23e625D4eBCeD8d3d05", //version deployed by Paladin
    PAL: "0xAdc832dAe99F5375c5F1B68986235089D2071ca3",
    HPAL: "0xB2eFA28c8f93A094c87C6B10BE66094BFEf8ede2",
}

const DELEGATOR_NAMES = {
    BASIC_DELEGATOR: 'BasicDelegator',
    AAVE_DELEGATOR: 'AaveDelegator',
    AAVE_DELEGATOR_CLAIMER: 'AaveDelegatorClaimer',
    SNAPSHOT_DELEGATOR: 'SnapshotDelegator',
    PAL_DELEGATOR_CLAIMER: 'PalDelegatorClaimer'
}

const MULTIPLIER_NAMES = {
    GOVERNOR: 'GovernorMultiplier',
    AAVE: 'AaveMultiplier'
}

const MULTIPLIER_CONTRACTS = {
    COMP: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Compound',
        GOVERNOR_ADDRESS: "0xc0Da02939E1441F497fd74F78cE7Decb17B66529"
    },
    UNI: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Uniswap',
        GOVERNOR_ADDRESS: "0x5e4be8Bc9637f0EAA1A755019e06A68ce081D58F"
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        GOV: 'Aave',
        GOVERNANCE_ADDRESS: "0xc2eBaB3Bac8f2f5028f5C7317027A41EBFCa31D2",
        STRATEGY_ADDRESS: "0x2012b02574F32a96b9CFb8Ba7Fdfd589D5c70F50",
    },
    IDLE: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Idle',
        GOVERNOR_ADDRESS: "0x782cB1dbd0bD4df95c2497819be3984EeA5c2c25"
    },
    /*INDEX: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        GOV: 'Index',
        GOVERNOR_ADDRESS: ""
    }*/
}

const MULTIPLIER_KEYS = {
    'COMP': MULTIPLIER_CONTRACTS.COMP,
    'UNI': MULTIPLIER_CONTRACTS.UNI,
    'AAVE': MULTIPLIER_CONTRACTS.AAVE,
    'IDLE': MULTIPLIER_CONTRACTS.IDLE,
    //'INDEX': MULTIPLIER_CONTRACTS.INDEX,
}


const POOLS_PARAMS = {
    COMP: {
        UNDERLYING: TOKENS.COMP,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin COMP',
        SYMBOL: 'palCOMP',
        MUTIPLIER: 'COMP'
    },
    UNI: {
        UNDERLYING: TOKENS.UNI,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin UNI',
        SYMBOL: 'palUNI',
        MUTIPLIER: 'UNI'
    },
    AAVE: {
        UNDERLYING: TOKENS.AAVE,
        DELEGATOR: 'AAVE_DELEGATOR',
        NAME: 'Paladin AAVE',
        SYMBOL: 'palAAVE',
        MUTIPLIER: 'AAVE'
    },
    STKAAVE: {
        UNDERLYING: TOKENS.STKAAVE,
        DELEGATOR: 'AAVE_DELEGATOR_CLAIMER',
        NAME: 'Paladin stkAAVE',
        SYMBOL: 'palStkAAVE',
        MUTIPLIER: 'AAVE'
    },
    IDLE: {
        UNDERLYING: TOKENS.IDLE,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin IDLE',
        SYMBOL: 'palIDLE',
        MUTIPLIER: 'IDLE'
    },
    INDEX: {
        UNDERLYING: TOKENS.INDEX,
        DELEGATOR: 'BASIC_DELEGATOR',
        NAME: 'Paladin INDEX',
        SYMBOL: 'palINDEX',
        MUTIPLIER: 'INDEX'
    },
    HPAL: {
        UNDERLYING: TOKENS.HPAL,
        DELEGATOR: 'PAL_DELEGATOR_CLAIMER',
        NAME: 'Paladin hPAL',
        SYMBOL: 'palhPAL',
        MUTIPLIER: ''
    }
}

const PAL_LOAN_TOKEN_URI = "about:blank"

const INTEREST_MODULE_VALUES = {
    BASE_RATE_PER_YEAR: ethers.utils.parseEther('0.25'),
    MULTIPLIER_PER_YEAR: ethers.utils.parseEther('0.9375'),
    JUMP_MULTIPLIER_PER_YEAR: ethers.utils.parseEther('13.25')
}

const ORACLE_BASE_SOURCE = "0x9326BFA02ADD2366b30bacB125260Af641031331"

const ORACLE_ASSET_LIST = {
    UNI: {
        ASSET: "0xFE32e7B30de865882f0DcDA353D40c40969F4531",
        SOURCE: ethers.constants.AddressZero,
        SOURCE_USD: "0xDA5904BdBfB4EF12a3955aEcA103F51dc87c7C39"
    },
    COMP: {
        ASSET: "0xB2224F5653b2b5094E465e3f676479763a015916",
        SOURCE: ethers.constants.AddressZero,
        SOURCE_USD: "0xECF93D14d25E02bA2C13698eeDca9aA98348EFb6"
    },
    AAVE: {
        ASSET: "0xbeda4e6081E09F7B8dc2b79B33aB1c60bDFa6a0C",
        SOURCE: "0xd04647B7CB523bb9f26730E9B6dE1174db7591Ad",
        SOURCE_USD: ethers.constants.AddressZero
    },
    STKAAVE: {
        ASSET: "0xeF89a9C8DF770A8964c339AA1073FB97F13BB943",
        SOURCE: "0xd04647B7CB523bb9f26730E9B6dE1174db7591Ad",
        SOURCE_USD: ethers.constants.AddressZero
    },
    IDLE: {
        ASSET: "0xD948412eaD3E12150E6357e2d8c3058933c3f47b",
        SOURCE: ethers.constants.AddressZero,
        SOURCE_USD: ethers.constants.AddressZero
    },
    HPAL: {
        ASSET: "",
        SOURCE: ethers.constants.AddressZero,
        SOURCE_USD: ethers.constants.AddressZero
    },
}


//Already deployed contracts : 


const POOLS = {
    COMP: {
        POOL: "0xa21fa099e94A2cF52Eb7425E02Bfff62d1E610C9",
        TOKEN: "0xB2224F5653b2b5094E465e3f676479763a015916"
    },
    UNI: {
        POOL: "0xca7924020aa36e3c8b4e16fC2ACF1BdeA4d6fb12",
        TOKEN: "0xFE32e7B30de865882f0DcDA353D40c40969F4531"
    },
    AAVE: {
        POOL: "0xd9Fe6DD7A09029710Cfd8660F2EcED1788a36beE",
        TOKEN: "0xbeda4e6081E09F7B8dc2b79B33aB1c60bDFa6a0C"
    },
    STKAAVE: {
        POOL: "0xeef13A28b0dBE30a4C6c128819B651697CE7961d",
        TOKEN: "0xeF89a9C8DF770A8964c339AA1073FB97F13BB943"
    },
    IDLE: {
        POOL: "0x92b2b1bf291f538ef47CAE11618b715020793dBe",
        TOKEN: "0xD948412eaD3E12150E6357e2d8c3058933c3f47b"
    },
    INDEX: {
        POOL: "0x8808ea9ad2b7E49D4FdB707166dEA20Dfd262a0e",
        TOKEN: "0x6625121F7AA0aEae65bDab28239043231Ae6Fa94"
    },
    HPAL: {
        POOL: "0x158d7dA233cE3C82cf1c4Cd71005eE5351884384",
        TOKEN: "0x3C3de77577Dd9CB14156cd9f99c988129fD2b472"
    }
}

const PAL_LOAN_TOKEN = "0xc8c5396B471B4FE7eB08b5e145f4DbEcE7860068";

const CONTROLLER = "0x957EEbF87f1adAD8F9862412f76247F305fe8F4d";

const INTEREST_MODULE = "";

const INTEREST_MODULE_V2 = "0x0A06DfeCBABECAa6887B0D8e680A45E9e86a9838";

const ADDRESS_REGISTRY = "0xD0d13c2790372ca63d5932E59d0c4e88e682D417";

const PRICE_ORACLE = "0x01C7470B4Bd7E25Acc40962B2aa84B423Dc74AeC";

const OLD_DELEGATORS = {
    BASIC_DELEGATOR: "0x60F1604c521dE75B1A1c8Ee48614F08BBd01bD3C",
    AAVE_DELEGATOR: "0x3Ad52159D14117535ef516bC3EDcDf353453E500",
    AAVE_DELEGATOR_CLAIMER: "0x9Be38C2Dc14a4BaD40b588d65Fe377C9F9c46495",
    SNAPSHOT_DELEGATOR: "0x1aE113966C29046CaC0490ceaFC7eb1Dc2426f38"
}

const DELEGATORS = {
    BASIC_DELEGATOR: "0xe1e623dE48d9753e285884f2e93da50ac264aE81",
    AAVE_DELEGATOR: "",
    AAVE_DELEGATOR_CLAIMER: "",
    SNAPSHOT_DELEGATOR: "",
    PAL_DELEGATOR_CLAIMER: "0x9b3917d9943a78Fa915a1dEa29e1852bc44742E4"
}

const MULTIPLIERS = {
    COMP: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.COMP,
        ADDRESS: "0xD634F6B19d2e63433adFEBe148Be8d0Fe90D2E06",
        POOLS: [
            POOLS.COMP.POOL
        ]
    },
    UNI: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.UNI,
        ADDRESS: "0x573504437a7D939E9920ce2E3CdBc448650337D9",
        POOLS: [
            POOLS.UNI.POOL
        ]
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        CONTRACT: MULTIPLIER_CONTRACTS.AAVE,
        ADDRESS: "0x1EE8F7508D0b0f71043e4941C4a4a0bD1b6c0ee2",
        POOLS: [
            POOLS.AAVE.POOL,
            POOLS.STKAAVE.POOL
        ]
    },
    IDLE: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.IDLE,
        ADDRESS: "0xAb1dd7D1b5F099Dd8A87dE4D91647BfF041E5911",
        POOLS: [
            POOLS.IDLE.POOL
        ]
    },
    /*INDEX: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.INDEX,
        ADDRESS: "",
        POOLS: [
            POOLS.INDEX.POOL
        ]
    },*/
}


module.exports = {
    TOKENS,
    DELEGATOR_NAMES,
    POOLS_PARAMS,
    POOLS,
    PAL_LOAN_TOKEN,
    CONTROLLER,
    INTEREST_MODULE,
    INTEREST_MODULE_V2,
    ADDRESS_REGISTRY,
    OLD_DELEGATORS,
    DELEGATORS,
    PAL_LOAN_TOKEN_URI,
    MULTIPLIER_CONTRACTS,
    MULTIPLIER_NAMES,
    INTEREST_MODULE_VALUES,
    MULTIPLIERS,
    MULTIPLIER_KEYS,
    ORACLE_BASE_SOURCE,
    ORACLE_ASSET_LIST,
    PRICE_ORACLE
};