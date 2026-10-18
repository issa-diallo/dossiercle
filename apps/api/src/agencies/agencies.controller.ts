import { Controller,Get,Inject,Param,Post,Req,Res } from '@nestjs/common';
import type { Request,Response } from 'express';
import { AgencyAccepted,ActivationView,ClaimInvitation,ClaimContext,CreateAgency,EmptyBody } from '@dossiercle/contracts';
import { AgenciesService } from './agencies.service.js';
import { T05HttpBoundary } from '../http/t05-boundary.js';
import { readT05Body,t05Uuid } from '../http/t05-request.js';
@Controller()
export class AgenciesController {
  constructor(@Inject(AgenciesService)private readonly service:AgenciesService,@Inject(T05HttpBoundary)private readonly boundary:T05HttpBoundary){}
  @Post('/v1/onboarding/invitation/claim')
  async claim(@Req()request:Request,@Res()response:Response){
    const command=this.boundary.command(request,{idempotent:false,versioned:false}),body=await readT05Body(request,ClaimInvitation);
    response.status(200).json(ClaimContext.parse(await this.service.claim(command,body)));
  }
  @Post('/v1/agencies')
  async create(@Req()request:Request,@Res()response:Response){
    const command=this.boundary.command(request,{idempotent:true,versioned:false}),body=await readT05Body(request,CreateAgency);
    response.status(202).json(AgencyAccepted.parse(await this.service.create(command,body.name)));
  }
  @Get('/v1/onboarding/agency')
  async get(@Req()request:Request,@Res()response:Response){
    this.boundary.check(request);const result=await this.service.get(request.headers.cookie);
    if(!result){response.status(204).end();return;}response.json(AgencyAccepted.parse(result));
  }
  @Get('/v1/agencies/:id/activation')
  async activation(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    this.boundary.check(request);response.setHeader('Cache-Control','no-store');response.json(ActivationView.parse(await this.service.getActivation(request.headers.cookie,t05Uuid(id))));
  }
  @Post('/v1/agencies/:id/activation')
  async activate(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    const command=this.boundary.command(request,{idempotent:true,versioned:true});await readT05Body(request,EmptyBody);
    response.setHeader('Cache-Control','no-store');response.status(200).json(ActivationView.parse(await this.service.activate(command,t05Uuid(id))));
  }
  @Post('/v1/agencies/:id/provisioning/retry')
  async retry(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    const command=this.boundary.command(request,{idempotent:true,versioned:true});await readT05Body(request,EmptyBody);
    response.setHeader('Cache-Control','no-store');response.status(202).json(AgencyAccepted.parse(await this.service.retry(command,t05Uuid(id))));
  }
}
