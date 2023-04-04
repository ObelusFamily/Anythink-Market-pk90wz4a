var mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
var slug = require("slug");
var User = mongoose.model("User");
var { Configuration, OpenAIApi } = require("openai");

var configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

var openai = new OpenAIApi(configuration);

var ItemSchema = new mongoose.Schema(
  {
    slug: { type: String, lowercase: true, unique: true },
    title: {type: String, required: [true, "can't be blank"]},
    description: {type: String, required: [true, "can't be blank"]},
    image: String,
    favoritesCount: { type: Number, default: 0 },
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
    tagList: [{ type: String }],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

ItemSchema.plugin(uniqueValidator, { message: "is already taken" });

ItemSchema.pre("validate", function(next) {
  if (!this.slug) {
    this.slugify();
  }

  next();
});

ItemSchema.methods.slugify = function() {
  this.slug =
    slug(this.title) +
    "-" +
    ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
};

ItemSchema.methods.updateFavoriteCount = function() {
  var item = this;

  return User.count({ favorites: { $in: [item._id] } }).then(function(count) {
    item.favoritesCount = count;

    return item.save();
  });
};

ItemSchema.methods.toJSONFor = function(user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    image: this.image,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tagList: this.tagList,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    seller: this.seller.toProfileJSONFor(user)
  };
};

ItemSchema.methods.createImage = async function() {
  const response = await openai.createImage({
    prompt: this.title ?? "",
    n: 1,
    size: "256x256",
  });

  if (
    response instanceof 'undefined'
    || response.data instanceof 'undefined'
    || response.data.data instanceof 'undefined'
    || response.data.data.length < 1
    || response.data.data instanceof 'undefined'
    || !(response.data.data[0].url instanceof 'string')
  ) {
    return;
  }

  this.image = response.data.data[0].url;
};

mongoose.model("Item", ItemSchema);
