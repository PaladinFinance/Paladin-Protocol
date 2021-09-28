const { ethers } = require("hardhat");

// Addresses for all_deploy :

const TOKENS = {
    COMP: "0xc00e94Cb662C3520282E6f5717214004A7f26888",
    AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
    STKAAVE: "0x4da27a545c0c5B758a6BA100e3a049001de870f5",
    UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"
}

const DELEGATOR_NAMES = {
    BASIC_DELEGATOR: 'BasicDelegator',
    AAVE_DELEGATOR: 'AaveDelegator',
    AAVE_DELEGATOR_CLAIMER: 'AaveDelegatorClaimer',
    SNAPSHOT_DELEGATOR: 'SnapshotDelegator'
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
        GOVERNOR_ADDRESS: "0x408ED6354d4973f66138C91495F2f2FCbd8724C3"
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        GOV: 'Aave',
        GOVERNANCE_ADDRESS: "0xEC568fffba86c094cf06b22134B23074DFE2252c",
        STRATEGY_ADDRESS: "0xEE56e2B3D491590B5b31738cC34d5232F378a8D5",
    }
}

const MULTIPLIER_KEYS = {
    'COMP': MULTIPLIER_CONTRACTS.COMP,
    'UNI': MULTIPLIER_CONTRACTS.UNI,
    'AAVE': MULTIPLIER_CONTRACTS.AAVE,
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
    }
}

const PAL_LOAN_TOKEN_URI = "about:blank"

const INTEREST_MODULE_VALUES = {
    BASE_RATE_PER_YEAR: ethers.utils.parseEther('0.25'),
    MULTIPLIER_PER_YEAR: ethers.utils.parseEther('0.9375'),
    JUMP_MULTIPLIER_PER_YEAR: ethers.utils.parseEther('13.25')
}


//Already deployed contracts : 


const POOLS = {
    COMP: {
        POOL: "",
        TOKEN: ""
    },
    UNI: {
        POOL: "",
        TOKEN: ""
    },
    AAVE: {
        POOL: "",
        TOKEN: ""
    },
    STKAAVE: {
        POOL: "",
        TOKEN: ""
    }
}

const PAL_LOAN_TOKEN = "";

const CONTROLLER = "";

const INTEREST_MODULE = "";

const INTEREST_MODULE_V2 = "";

const ADDRESS_REGISTRY = "";

const DELEGATORS = {
    BASIC_DELEGATOR: "",
    AAVE_DELEGATOR: "",
    AAVE_DELEGATOR_CLAIMER: "",
    SNAPSHOT_DELEGATOR: ""
}

const MULTIPLIERS = {
    COMP: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.COMP,
        ADDRESS: "",
        POOLS: [
            POOLS.COMP.POOL
        ]
    },
    UNI: {
        NAME: MULTIPLIER_NAMES.GOVERNOR,
        CONTRACT: MULTIPLIER_CONTRACTS.UNI,
        ADDRESS: "",
        POOLS: [
            POOLS.UNI.POOL
        ]
    },
    AAVE: {
        NAME: MULTIPLIER_NAMES.AAVE,
        CONTRACT: MULTIPLIER_CONTRACTS.AAVE,
        ADDRESS: "",
        POOLS: [
            POOLS.AAVE.POOL,
            POOLS.STKAAVE.POOL
        ]
    }
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
    DELEGATORS,
    PAL_LOAN_TOKEN_URI,
    MULTIPLIER_CONTRACTS,
    MULTIPLIER_NAMES,
    INTEREST_MODULE_VALUES,
    MULTIPLIERS,
    MULTIPLIER_KEYS
};