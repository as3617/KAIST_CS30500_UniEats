import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { toObjectId } from "../common/object-id";
import { Cafeteria } from "./schemas/cafeteria.schema";

@Injectable()
export class CafeteriasService {
  constructor(
    @InjectModel(Cafeteria.name)
    private readonly cafeteriaModel: Model<Cafeteria>,
  ) {}

  async findAll() {
    const cafeterias = await this.cafeteriaModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();

    return cafeterias.map((cafeteria) => this.toListItem(cafeteria));
  }

  async findById(cafeteriaId: string) {
    const _id = toObjectId(cafeteriaId, "cafeteriaId");
    const cafeteria = await this.cafeteriaModel.findOne({ _id, isActive: true }).lean().exec();

    if (!cafeteria) {
      throw new NotFoundException("cafeteria not found");
    }

    return this.toDetail(cafeteria);
  }

  private toListItem(cafeteria: any) {
    return {
      id: cafeteria._id.toString(),
      name: cafeteria.name,
      description: cafeteria.description,
      location: cafeteria.location ?? {},
      openingHours: cafeteria.openingHours ?? {},
    };
  }

  private toDetail(cafeteria: any) {
    return this.toListItem(cafeteria);
  }
}
