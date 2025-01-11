import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: [String], default: [] })
  roles: string[];

  @Prop({ default: 0 })
  eloRating: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
