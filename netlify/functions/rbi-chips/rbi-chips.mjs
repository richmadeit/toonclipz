// Default endpoint: /.netlify/functions/rbi-chips?route=config
// This function deliberately does not claim /api/* or change other site routes.
import {SupabaseRepository} from './lib/repository.mjs';
import {makeAuth} from './lib/auth.mjs';
import {createHandler} from './lib/app.mjs';
import {readRbiEnv} from './lib/environment.mjs';
const env=readRbiEnv();
const repo=new SupabaseRepository(env);
export default createHandler({repo,auth:makeAuth(env),env,loadBonus:()=>repo.bonus()});
