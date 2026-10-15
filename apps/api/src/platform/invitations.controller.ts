import { Controller,Get,Inject,Param,Post,Req,Res } from '@nestjs/common';
import type { Request,Response } from 'express';
import { CreateInvitation,EmptyBody,InvitationAccepted,InvitationIssued,InvitationView } from '@dossiercle/contracts';
import { InvitationsService } from './invitations.service.js';
import { readT05Body,t05Uuid } from '../http/t05-request.js';
import { T05HttpBoundary } from '../http/t05-boundary.js';
@Controller('/v1/platform/agencies/invitations')
export class InvitationsController {
  constructor(@Inject(InvitationsService)private readonly service:InvitationsService,@Inject(T05HttpBoundary)private readonly boundary:T05HttpBoundary){}
  @Post()
  async create(@Req()request:Request,@Res()response:Response){
    const command=this.boundary.command(request,{idempotent:true,versioned:false}),body=await readT05Body(request,CreateInvitation);
    response.status(202).json(InvitationAccepted.parse(await this.service.create(command,body)));
  }
  @Get('/:id')
  async get(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    this.boundary.check(request);response.json(InvitationView.parse(await this.service.get(request.headers.cookie,t05Uuid(id))));
  }
  @Post('/:id/issue')
  async issue(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    const command=this.boundary.command(request,{idempotent:true,versioned:true});await readT05Body(request,EmptyBody);
    response.status(200).json(InvitationIssued.parse(await this.service.issue(command,t05Uuid(id))));
  }
  @Post('/:id/revoke')
  async revoke(@Req()request:Request,@Res()response:Response,@Param('id')id:string){
    const command=this.boundary.command(request,{idempotent:true,versioned:true});await readT05Body(request,EmptyBody);
    response.status(200).json(InvitationView.parse(await this.service.revoke(command,t05Uuid(id))));
  }
}
