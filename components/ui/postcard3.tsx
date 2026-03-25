import { Link } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View, type ImageSourcePropType } from "react-native";
import { resolveMediaUrl, type Post } from "../../lib/api";
import Heart from "./heart2";

function PostcardTitleOnly({ post }: { post: Post }) {
    const resolved = resolveMediaUrl(post.image_url);
    const thumbSource: ImageSourcePropType = resolved
        ? { uri: resolved }
        : require("../../assets/images/brend1.png");

    return (
        <Link
            href={{ pathname: "/[id]", params: { id: post.id } }}
            asChild
        >
            <Pressable
                style={{
                    paddingVertical: 2,
                    paddingHorizontal: 2,
                    backgroundColor: "white",
                    position: "relative",
                    borderBottomWidth: 1,
                    borderBottomColor: "#eee",
                }}
            >
                {/* 좋아요 버튼 */}
                <Heart
                    postId={post.id}
                    postLiked={post.liked}
                    style={{
                        position: "absolute",
                        top: 5,
                        right: 3,
                        zIndex: 10,
                    }}
                />

                {/* 제목만 표시 */}
                <View>
                    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 34 }}>
                        {/* 제목 왼쪽 이미지(썸네일) */}
                        <Image
                            source={thumbSource}
                            style={{
                                width: 33,
                                height: 33,
                                borderRadius: 5,
                                marginRight: 8,
                                borderWidth: 1,
                                borderColor: "#ddd",
                                backgroundColor: "#f3f3f3",
                            }}
                        />

                        <Text
                            style={{
                                fontWeight: "600",
                                fontSize: 17,
                                color: "black",
                                flex: 1,
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {post.title}
                        </Text>
                    </View>
                </View>
            </Pressable>
        </Link>
    );
}

export default React.memo(PostcardTitleOnly);
