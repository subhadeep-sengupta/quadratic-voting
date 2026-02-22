use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{Dao, Proposal, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    pub dao: Account<'info, Dao>,

    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = Vote::DISCRIMINATOR.len() + Vote::INIT_SPACE,
        seeds = [b"vote", voter.key().as_ref()],
        bump
    )]
    pub vote: Account<'info, Vote>,

    #[account(
        token::authority = voter,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
}

impl<'info> CastVote<'info> {
    pub fn cast_vote(&mut self, vote_type: u8) -> Result<()> {
        let vote_credits = (self.creator_token_account.amount as f64).sqrt() as u64;

        self.vote.set_inner(Vote {
            authority: self.vote.key(),
            vote_type,
            vote_credits,
            bump: self.vote.bump,
        });

        Ok(())
    }
}
