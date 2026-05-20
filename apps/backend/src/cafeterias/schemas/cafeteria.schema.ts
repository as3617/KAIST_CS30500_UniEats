import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CafeteriaDocument = HydratedDocument<Cafeteria>;

@Schema({ _id: false })
export class Location {
  @Prop({ trim: true })
  building?: string;

  @Prop({ trim: true })
  floor?: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ type: Number })
  lat?: number;

  @Prop({ type: Number })
  lng?: number;
}

export const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false })
export class TimeRange {
  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  open: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  close: string;
}

export const TimeRangeSchema = SchemaFactory.createForClass(TimeRange);

@Schema({ _id: false })
export class OpeningHours {
  @Prop({ type: [TimeRangeSchema], default: [] })
  monday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  tuesday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  wednesday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  thursday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  friday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  saturday?: TimeRange[];

  @Prop({ type: [TimeRangeSchema], default: [] })
  sunday?: TimeRange[];
}

export const OpeningHoursSchema = SchemaFactory.createForClass(OpeningHours);

@Schema({ collection: "cafeterias", timestamps: true })
export class Cafeteria {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: LocationSchema, default: () => ({}) })
  location: Location;

  @Prop({ type: OpeningHoursSchema, default: () => ({}) })
  openingHours: OpeningHours;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export const CafeteriaSchema = SchemaFactory.createForClass(Cafeteria);

CafeteriaSchema.index({ name: 1 }, { unique: true });
CafeteriaSchema.index({ isActive: 1 });
