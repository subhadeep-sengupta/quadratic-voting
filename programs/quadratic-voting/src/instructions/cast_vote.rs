use anchor_lang::prelude::*;

use crate::state::Dao;

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_prgram: Program<'info, System>,
}
