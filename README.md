# Scalr
[![TON](https://img.shields.io/badge/based%20on-TON-blue)](https://ton.org/)
[![License](https://img.shields.io/badge/license-GPL--3.0-brightgreen)](https://opensource.org/licenses/GPL-3.0)

Scarl is oracle-based peer-to-pool perpetual futures decentralized exchange that support low fees, instant trades execution and low price impact.

Core contracts for the Scalr protocol.

## Arhitecture

Scalr smart contract is combined with centralized services hosted in the cloud. The contract is a single-asset vault with keeper permission for asset withdrawals. The contract is solely responsible for storing collateral, while all trading activities are handled by the *Trading Engine*. 

<img src="https://drive.google.com/uc?export=view&id=1NIzmIB1iWx_5XbfpMae7fK_VjqbFFuMC"/>

## How it works 

- *User* deposits jettons directly into the *Vault's jetton wallet* by sending a `transfer` from their own *User's jetton wallet*.
- The *Keeper* monitors the *Vault's jetton wallet* for `transfer_notification` events and updates the *Trading Engine* database with the corresponding deposit records.
- The *User* submits trading orders off-chain to the *Trading Engine*.
- To withdraw funds, the *User* must make an on-chain withdrawal request by sending a `request_withdrawal` message to the *Vault*, specifying a minimum amount of 0.6 TON. Any remaining TON after the execution will be transferred to the *Keeper*.
- The *Keeper* reviews withdrawal requests, validates them, and, if valid, transfers jettons to the user's wallet by sending a `withdraw` message.
- For invalid requests, the *Keeper* sends a `refuse_withdraw` message to the *Vault*.
- The *Admin* sets the *Vault's* jetton wallet address by sending a `set_jetton_wallet` message.
- The *Admin* can change their address, the Keeper's address, and the Vault's contract code, with changes governed by a timelock.


<img src="https://drive.google.com/uc?export=view&id=1JkQvwpiq18sXY03SPDOiTtYKfumm6ihA"/> 
<img src="https://drive.google.com/uc?export=view&id=1x71SP3m2gCq_AjGDaTXLUvWXhq932R1x"/> 

## Messages

There are a few messages that interact with the contract:

| Message | Opcode | Role | Description |
| ------------- | ------------- | ------------- | ------------- |
| (Jetton wallet) `transfer` | `0xf8a7ea5` | *User* | Deposit jettons to the contract |
| `request_withdrawal` | `0x25d4fcff` | *User* | Request withdrawal of jettons from the contract |
| `refuse_withdrawal` | `0xe659c222` |  *Keeper* | Refuse withdrawal of jettons from the contract |
| `withdraw` | `0xb5de5f9e` |  *Keeper* | Withdrawal of jettons from the contract to the user |
| `set_vault_jetton_wallet` | `0xed105058` |  *Admin* | Set the contract's jetton wallet address in storage |
| `init_code_upgrade` | `0xdf1e233d` |  *Admin* | Initiate a code upgrade with a 7-day timelock |
| `init_admin_upgrade` | `0x2fb94384` |  *Admin* | Initiate an admin address change with 2 days timelock |
| `init_keeper_upgrade` | `0x8349e5be` |  *Admin* | Initiate a keeper address change with 2 days timelock |
| `cancel_code_upgrade` | `0x357ccc67` |  *Admin* | Cancel a code upgrade |
| `cancel_admin_upgrade` | `0xa4ed9981` |  *Admin* | Cancel an admin address change |
| `cancel_keeper_upgrade` | `0xf3a845eb` |  *Admin* | Cancel a keeper address change |
| `finalize_upgrades` | `0x6378509f` |  *Admin* | Finalize updates once the timelock period has ended |

### TL-B schemas

```
transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16) destination:MsgAddress
                 response_destination:MsgAddress custom_payload:(Maybe ^Cell)
                 forward_ton_amount:(VarUInteger 16) forward_payload:(Either Cell ^Cell)
                 = InternalMsgBody;

transfer_notification#7362d09c query_id:uint64 amount:(VarUInteger 16)
                              sender:MsgAddress forward_payload:(Either Cell ^Cell)
                              = InternalMsgBody;

---                 

request_withdrawal#0f8a7ea5 query_id:uint64 jetton_amount:(VarUInteger 16) 
                           user_address:MsgAddress 
                           = InternalMsgBody;

refuse_withdrawal#25d4fcff query_id:uint64 jetton_amount:(VarUInteger 16) 
                          user_address:MsgAddress 
                          = InternalMsgBody;

withdraw#b5de5f9e query_id:uint64 jetton_amount:(VarUInteger 16) 
                 user_address:MsgAddress fwd_value:(VarUInteger 16) 
                 = InternalMsgBody;

set_vault_jetton_wallet#ed105058 query_id:uint64 vault_jetton_wallet:MsgAddress 
                                = InternalMsgBody;

init_code_upgrade#df1e233d query_id:uint64 new_code:(Either Cell ^Cell) 
                          = InternalMsgBody;

init_admin_upgrade#2fb94384 query_id:uint64 new_admin:MsgAddress 
                           = InternalMsgBody;

init_keeper_upgrade#8349e5be query_id:uint64 new_keeper:MsgAddress 
                            = InternalMsgBody;

cancel_code_upgrade#357ccc67 query_id:uint64 
                            = InternalMsgBody;

cancel_admin_upgrade#a4ed9981 query_id:uint64 
                             = InternalMsgBody;

cancel_keeper_upgrade#f3a845eb query_id:uint64 
                              = InternalMsgBody;

finalize_upgrades#6378509f query_id:uint64 
                          = InternalMsgBody;
```

<img src="https://drive.google.com/uc?export=view&id=1-uvr8ZURDZb7aQ6Shak9efSfGjBKrzjJ"/>

## Deploy

Requires node 16 or higher.

In order to deploy the contract use the following procedure:
1. set the following environment variables:
* MAINNET (`"1"` or `"0"` for testnet)
* JETTON_ADDRESS (Address of jetton minter contract)
* ADMIN_ADDRESS
* KEEPER_ADDRESS <br/>
Environment variables can be set by export or using .env file. For example: `export JETTON_ADDRESS=Ef8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAU` or insert `JETTON_ADDRESS=Ef8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAU` to .env file.
2. run `npm install` to init [Blueprint](https://github.com/ton-org/blueprint).
3. run `npx blueprint build` to compile FunC contract.
4. run `npx blueprint run`. This script will deploy the Vault contract with the ADMIN_ADDRESS and KEEPER_ADDRESS which were set as the environment variables, then set Vault's jetton wallet address based on JETTON_ADDRESS. Make sure you have funds in this address which will be used for deployment. 0.05 TON should be enough for deployment. 

Standard jetton processing methods are sufficient to analyze the Vault's Total Value Locked (TVL) by examining the balance of the Vault's jetton wallet.

## Tests

Tests are conducted using [Sandbox](https://github.com/ton-org/sandbox) and covers various contract behavior. After compiling the contracts, run `npx blueprint test` command to execute the tests.

Tests list:
- should deploy
- should deposit
- should withdrawal request
- should refuse withdrawal
- should break refuse withdrawal not by keeper
- should set jetton wallet by admin
- should break set jetton wallet not by admin
- should break withdrawal not by keeper
- should withdrawal by keeper
- should storage fees cost less than 1 TON
- should change admin address
- should change keeper address
- should change code
- should not change any from not admin

## Risks

There are inherent risks in a centralized architecture, such as private key leakage. Additionally, there are TON-specific risks, including the uncertainty around value spent on jetton transfers.

## Licensing
The license for Scalr Perpetual Futures Decentralized Exchange is the GNU General Public License v3.0 (GPL-3.0), see [LICENSE](LICENSE).