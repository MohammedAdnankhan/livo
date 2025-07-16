const moment = require("moment-timezone");
const Comment = require("../../comment-service/models/Comment");
const { TARGET_AUDIENCE, LANGUAGES } = require("../../config/constants");
const db = require("../../database");
const {
  getFlatWithLocality,
  getFlat,
} = require("../../flat-service/controllers/flat");
const {
  getLikesCount,
  checkIsLiked,
} = require("../../like-service/controllers/like");
const User = require("../../user-service/models/User");
const { AppError } = require("../../utils/errorHandler");
const Post = require("../models/Post");
const PostFile = require("../models/PostFile");

//create post
const createPost = async (data) => {
  if (!Object.values(TARGET_AUDIENCE).includes(data.targetAudience))
    throw new AppError("createPost", "Invalid Target Audience Value");

  const postData = {
    createdBy: data.createdBy,
    content: data.content ? data.content : null,
    targetAudience: data.targetAudience,
  };

  if (postData.targetAudience === TARGET_AUDIENCE.BUILDING) {
    postData.targetId = (await getFlat({ id: data.flatId })).buildingId;
  } else {
    postData.targetId = (
      await getFlatWithLocality({ id: data.flatId })
    ).building.locality.id;
  }

  const t = await db.sequelize.transaction();
  try {
    const post = await Post.create(postData, { transaction: t });

    if (!Array.isArray(data.documents)) {
      await t.commit();
      return post;
    }
    let docsArray = [];
    for (doc of data.documents) {
      const docBody = {
        postId: post.id,
        name: doc.name ? doc.name : null,
      };
      if (doc.content.startsWith("https://")) {
        docBody.content = doc.content;
        const contentArray = doc.content.split(".");
        docBody.type = contentArray[contentArray.length - 1];
      } else if (doc.content.startsWith("+")) {
        docBody.type = "contact";
        docBody.content = doc.content.substr(1);
      } else if (!isNaN(doc.content)) {
        docBody.content = doc.content;
        docBody.type = "contact";
      }
      const newFile = await PostFile.create(docBody, { transaction: t });
      docsArray.push(newFile);
    }
    await t.commit();
    return { post, documents: docsArray };
  } catch (error) {
    console.log(error);
    await t.rollback();
    throw error;
  }
};

//get a specific post
const getSpecificPostWithFiles = async (params, { userId }) => {
  const findPost = await Post.findOne({
    where: params,
    include: [
      {
        model: PostFile,
        as: "documents",
        required: false,
      },
      {
        model: User,
        as: "user",
        required: true,
        attributes: ["id", "name", "profilePicture"],
      },
    ],
  });
  if (!findPost) {
    throw new AppError("getSpecificPostWithFiles", "Post not found");
  }
  const numberOfComments = await Comment.count({
    where: { postId: params.id },
  });
  const totalLikes = await getLikesCount({ postId: params.id, shareId: null });

  const isLiked = await checkIsLiked({
    postId: params.id,
    userId,
    shareId: null,
  });

  return {
    post: findPost,
    totalComments: numberOfComments,
    totalLikes,
    isLiked,
  };
};

//get your own posts
const getOwnPosts = async (
  params,
  language = LANGUAGES.EN,
  { limit, offset }
) => {
  const { buildingId } = await getFlat({ id: params.flatId }, language);
  const query = `
    select t1.*, u.name as "userDetails.name", u.id as "userDetails.id", u."profilePicture" as "userDetails.profilePicture",
    case when t2."numOfLikes" is null then 0 else t2."numOfLikes" end as "numOfLikes",
    case when t3."numOfComments" is null then 0 else t3."numOfComments" end as "numOfComments",
    case when t4.id is not null then true else false end as "isLiked",
    case when t5."numOfShares" is null then 0 else t5."numOfShares" end as "numOfShares"
    from (
      select p1.*, null as "shareId", null as "shareUserDetails.name", null as "shareUserDetails.id", null as "shareUserDetails.profilePicture", null as "sharedAt" from posts p1
      where p1."targetId" = :buildingId
      and p1."deletedAt" is null
      union all
      select p2.*, sp.id as "shareId", u.name as "shareUserDetails.name", u.id as "shareUserDetails.id", u."profilePicture" as "shareUserDetails.profilePicture", sp."createdAt" as "sharedAt" from posts p2 
      join shares sp on sp."postId" = p2.id
      join users u on u.id = sp."userId"
      where p2."targetId" = :buildingId
      and sp."deletedAt" is null
    ) as t1
    join users u on t1."createdBy"=u.id and t1."createdBy"=:userId
    left join (
      select count(*) as "numOfLikes", "postId", "shareId" from likes where "deletedAt" is null group by "postId", "shareId" 
    ) as t2 on t2."postId" = t1.id and ((t1."shareId" is null and t2."shareId" is null) or t2."shareId" = t1."shareId")
    left join (
      select count(*) as "numOfComments", "postId", "shareId" from comments where "deletedAt" is null group by "postId", "shareId"
    ) as t3 on t3."postId" = t1.id and ((t1."shareId" is null and t3."shareId" is null) or t3."shareId" = t1."shareId")
    left join (
      select id, "postId", "userId", "shareId" from likes where "userId" = :userId and "deletedAt" is null
    ) as t4 on t4."postId" = t1.id and ((t1."shareId" is null and t4."shareId" is null) or t4."shareId" = t1."shareId")
    left join (
      select count(*) as "numOfShares", "postId" from shares where "deletedAt" is null group by "postId"
    ) as t5 on t5."postId" = t1.id
    order by case when t1."sharedAt" is null then t1."createdAt" else t1."sharedAt" end DESC
    limit :limit offset :offset
  `;

  const feeds = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      userId: params.createdBy,
      limit,
      offset,
    },
    nest: true,
  });

  for (const feed of feeds) {
    feed.creationTime = moment(feed.createdAt).from(moment());
    if (feed.sharedAt) {
      feed.sharedTime = moment(feed.sharedAt).from(moment());
    }
  }

  await Promise.all(
    feeds.map(async (feed) => {
      const files = await PostFile.findAll({
        where: {
          postId: feed.id,
        },
        attributes: ["type", "name", "content", "id"],
      });
      feed.files = files;
    })
  );

  return feeds;
};

//delete a post
const deletePost = async (params) => {
  const post = await Post.findOne({ where: params });
  if (!post) {
    throw new AppError("deletePost", "Post not found");
  }
  await PostFile.destroy({ where: { postId: post.id } });
  await post.destroy();
  return;
};

//get all files of a post
const getPostFiles = async (params, query, { offset, limit }) => {
  let order = [["createdAt", "DESC"]];
  query.type && (params.type = query.type);
  const files = await PostFile.findAndCountAll({
    where: params,
    order,
    offset,
    limit,
  });
  return files;
};

async function getPost(params, attributes = []) {
  return Post.findOne({
    where: params,
    attributes: attributes.length ? attributes : null,
  });
}

module.exports = {
  createPost,
  getSpecificPostWithFiles,
  getOwnPosts,
  getPostFiles,
  getPost,
  deletePost,
};
