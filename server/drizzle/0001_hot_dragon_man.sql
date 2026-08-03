CREATE TABLE "gallery_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) DEFAULT '' NOT NULL,
	"image_url" text,
	"video_url" text,
	"type" varchar(20) DEFAULT 'image' NOT NULL,
	"prompt" text,
	"model_slug" varchar(100),
	"capability_slug" varchar(100),
	"thumbnail_url" text,
	"likes" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_work_id_gallery_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."gallery_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_likes" ADD CONSTRAINT "gallery_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_works" ADD CONSTRAINT "gallery_works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gallery_likes_work_id_idx" ON "gallery_likes" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "gallery_likes_user_id_idx" ON "gallery_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gallery_likes_work_user_unique_idx" ON "gallery_likes" USING btree ("work_id","user_id");--> statement-breakpoint
CREATE INDEX "gallery_works_user_id_idx" ON "gallery_works" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gallery_works_type_idx" ON "gallery_works" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gallery_works_is_published_idx" ON "gallery_works" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "gallery_works_created_at_idx" ON "gallery_works" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gallery_works_likes_idx" ON "gallery_works" USING btree ("likes");