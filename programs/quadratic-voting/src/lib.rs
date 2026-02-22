use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("fdzA8f51UdSfZdoA8eQKV3i5rX9GjAfscXy3j1NFbx9");

#[program]
pub mod quadratic_voting {
    use super::*;

    pub fn init_dao(ctx: Context<InitDao>, name: String) -> Result<()> {
        ctx.accounts.init_dao(name)
    }

    pub fn init_proposal(ctx: Context<InitProposal>, metadata: String) -> Result<()> {
        ctx.accounts.init_proposal(metadata)
    }

    pub fn cast_vote(ctx: Context<CastVote>, vote_type: u8) -> Result<()> {
        ctx.accounts.cast_vote(vote_type)
    }
}
