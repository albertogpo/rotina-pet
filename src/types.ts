export type Species="cat"|"dog";export type FoodUnit="g"|"ml"|"sachet"|"can"|"scoop"|"unit";export type MealStatus="pending"|"completed"|"skipped";
export type Pet={id:string;user_id:string;name:string;species:Species;icon:string;active:boolean;created_at:string};
export type WeightEntry={id:string;user_id:string;pet_id:string;recorded_at:string;weight_kg:number;notes:string|null;created_at:string};
export type Food={id:string;user_id:string;name:string;default_unit:FoodUnit;active:boolean;created_at:string};
export type MealComponentView={id:string;quantity:number;unit:FoodUnit;foods:{name:string}|null};
export type MealTemplateView={id:string;scheduled_time:string;sequence:number;meal_components:MealComponentView[]};
export type MealOccurrence={id:string;user_id:string;pet_id:string;meal_template_id:string;local_date:string;scheduled_at:string;status:MealStatus;completed_at:string|null;notes:string|null;meal_templates:MealTemplateView|null};
export type PlanFoodInput={foodId:string;dailyQuantity:string;unit:FoodUnit;mealSequences:number[]};
