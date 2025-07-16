const moment = require("moment-timezone");
const {
  LANGUAGES,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
} = require("../../config/constants");
const db = require("../../database");
const { getFlat } = require("../../flat-service/controllers/flat");
const PostFile = require("./../../post-service/models/PostFile");

async function getFeedPosts(
  params = {},
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
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
    join users u on t1."createdBy"=u.id
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
    where (u.name ilike :nameRegex or t1."shareUserDetails.name" ilike :nameRegex)
    order by case when t1."sharedAt" is null then t1."createdAt" else t1."sharedAt" end DESC
    limit :limit offset :offset
  `;

  const feeds = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      userId: params.userId,
      nameRegex: params.username ? `%${params.username}%` : "%",
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
}

// getFeedPosts(
//   {
//     flatId: "49dcdbf0-8f1c-11ec-9718-677b08ade66c",
//     userId: "8814e32c-f3bc-41a6-890d-b68a21bfd211",
//   },
//   { limit: 10, offset: 0 }
// );

async function getFeedMarketPlaces(
  params = {},
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
  const { buildingId } = await getFlat({ id: params.flatId }, language);

  const query = `
    select mp.category as category, mp.condition as condition, mp.title, mp.price, mp.age, mp.currency, mp.images as files, mp."createdAt", mp."updatedAt", mp.id, mp.description,
    u.name as "userDetails.name", u.id as "userDetails.id", u."profilePicture" as "userDetails.profilePicture", 
    true as "isMarketPlace"
    from market_places mp
    join users u on u.id = mp."createdBy"
    where mp."targetId" = :buildingId
    and mp."deletedAt" is null
    and mp.title ilike :titleRegex
    order by mp."createdAt" DESC
    limit :limit offset :offset
  `;

  const marketPlaces = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      titleRegex: params.title ? `%${params.title}%` : "%",
      limit,
      offset,
    },
    nest: true,
  });

  for (const marketPlace of marketPlaces) {
    marketPlace.creationTime = moment(marketPlace.createdAt).from(moment());
    marketPlace.category =
      ITEM_CATEGORIES[marketPlace.category][`category_${language}`];
    marketPlace.condition =
      ITEM_CONDITIONS[marketPlace.condition][`condition_${language}`];
    marketPlace.age = moment(marketPlace.updatedAt)
      .subtract(marketPlace.age, "seconds")
      .from(moment(marketPlace.updatedAt), true);
  }

  return marketPlaces;
}

async function getFeed(
  params = {},
  { limit, offset },
  timezone,
  language = LANGUAGES.EN
) {
  const { buildingId } = await getFlat({ id: params.flatId }, language);

  const query = `
    select * from (
      select t1.id, t1.content, t1."createdAt", t1."shareId", t1."shareUserDetails.name", t1."shareUserDetails.id", t1."shareUserDetails.profilePicture", t1."sharedAt",
      u.name as "userDetails.name", u.id as "userDetails.id", u."profilePicture" as "userDetails.profilePicture",
      case when t2."numOfLikes" is null then 0 else t2."numOfLikes" end as "numOfLikes",
      case when t3."numOfComments" is null then 0 else t3."numOfComments" end as "numOfComments",
      case when t4.id is not null then true else false end as "isLiked",
      case when t5."numOfShares" is null then 0 else t5."numOfShares" end as "numOfShares",
      null as category, null as condition, null as title, null as price, null as age, null as currency, null as files, null as description,
      false as "isMarketPlace"
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
      join users u on t1."createdBy"=u.id
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
      where (u.name ilike :search or t1."shareUserDetails.name" ilike :search)
      union all
      select mp.id, null as content, mp."createdAt", null as "shareId", null as "shareUserDetails.name", null as "shareUserDetails.id", null as "shareUserDetails.profilePicture", null as "sharedAt",
      u.name as "userDetails.name", u.id as "userDetails.id", u."profilePicture" as "userDetails.profilePicture",
      null as "numOfLikes", null as "numOfComments", null as "isLiked", null as "numOfShares", 
      mp.category as category, mp.condition as condition, mp.title, mp.price, mp.age, mp.currency, mp.images as files, mp.description,
      true as "isMarketPlace"
      from market_places mp
      join users u on u.id = mp."createdBy"
      where mp."targetId" = :buildingId
      and mp."deletedAt" is null
      and mp.title ilike :search
    ) as feed
    order by case when feed."sharedAt" is null then feed."createdAt" else feed."sharedAt" end DESC
    limit :limit offset :offset
  `;

  const feeds = await db.sequelize.query(query, {
    raw: true,
    type: db.Sequelize.QueryTypes.SELECT,
    replacements: {
      buildingId,
      userId: params.userId,
      search: params.search ? `%${params.search}%` : "%",
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
    if (feed.category) {
      feed.category = ITEM_CATEGORIES[feed.category][`category_${language}`];
    }
    if (feed.condition) {
      feed.condition = ITEM_CONDITIONS[feed.condition][`condition_${language}`];
    }
  }

  await Promise.all(
    feeds.map(async (feed) => {
      if (!feed.isMarketPlace) {
        const files = await PostFile.findAll({
          where: {
            postId: feed.id,
          },
          attributes: ["type", "name", "content", "id"],
        });
        feed.files = files;
      }
    })
  );

  return feeds;
}

// getFeed(
//   {
//     flatId: "49dcdbf0-8f1c-11ec-9718-677b08ade66c",
//     userId: "8814e32c-f3bc-41a6-890d-b68a21bfd211",
//   },
//   { limit: 10, offset: 0 }
// );

module.exports = {
  getFeedPosts,
  getFeedMarketPlaces,
  getFeed,
};
