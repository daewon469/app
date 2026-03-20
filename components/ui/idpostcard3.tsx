import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text as RNText,
  TextInput,
  View,
} from "react-native";
import { Card } from "react-native-paper";
import type { Comment, Post } from "../../lib/api";
import { Comments, Posts } from "../../lib/api";
import CommentItem, { CommentNode } from "./comment";

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} allowFontScaling={false} />
);

type Props = {
  post: Post;
};
const screenWidth = Dimensions.get("window").width;
export default function SimplePostDetail({ post }: Props) {
  const { fromPush } = useLocalSearchParams();
  const isFromPush = fromPush === "1";
  const scrollRef = useRef<ScrollView>(null);
  const handleFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const colors = {
    // 배경은 베이지
    background: "#fff",
    card: "#fff",
    text: "#000",
    // 카드는 검은 테두리
    border: "#000",
    subText: "#666",
    primary: "#4A6CF7",
  };

  const createdAt = new Date(post.created_at);

  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentNode | null>(null);
  const [editingComment, setEditingComment] = useState<CommentNode | null>(null);
  const [editingText, setEditingText] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const loadComments = async () => {
    try {
      const res = await Comments.list(post.id, cursor, 20);

      const sorted = [...res.items].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setComments(sorted);

      if (res.next_cursor) setCursor(res.next_cursor);
    } finally {
      setLoadingComments(false);
    }
  };
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync("username");
      setCurrentUsername(stored);
      loadComments();
    })();
  }, []);


  const buildTree = (items: Comment[]): CommentNode[] => {
    const map = new Map<number, CommentNode>();
    const roots: CommentNode[] = [];

    items.forEach((c) => {
      map.set(c.id, { ...c, children: [] });
    });

    map.forEach((node) => {
      if (node.parent_id) {
        const parent = map.get(node.parent_id);
        if (parent) {
          parent.children?.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const commentTree = buildTree(comments);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    if (!currentUsername) {
      Alert.alert("알림", "로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }

    const content = newComment.trim();
    let res;

    if (replyTarget) {
      res = await Comments.reply(post.id, replyTarget.id, currentUsername, content);
    } else {
      res = await Comments.create(post.id, currentUsername, content);
    }

    if (!res.ok || !res.comment) {
      Alert.alert("오류", res.error ?? "댓글 등록에 실패했습니다.");
      return;
    }

    setComments((prev) => [...prev, res.comment]);
    setNewComment("");
    setReplyTarget(null);
  };

  const startEdit = (node: CommentNode) => {
    setEditingComment(node);
    setEditingText(node.content);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditingText("");
  };

  const submitEdit = async () => {
    if (!editingComment || !editingText.trim()) return;

    const res = await Comments.update(
      editingComment.id,
      currentUsername ?? "",
      editingText.trim()
    );

    if (res.ok && res.comment) {
      setComments((prev) =>
        prev.map((c) => (c.id === res.comment.id ? res.comment : c))
      );
      setEditingComment(null);
      setEditingText("");
    }
  };
  const deleteComment = (node: CommentNode) => {
    Alert.alert("삭제", "정말 이 댓글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const res = await Comments.remove(node.id, currentUsername ?? "");
          if (res.ok) {
            setComments((prev) =>
              prev.map((c) =>
                c.id === node.id
                  ? { ...c, is_deleted: true, content: "" }
                  : c
              )
            );
          }
        },
      },
    ]);
  };

  const onDeletePost = () => {
    Alert.alert("삭제", "정말 게시글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await Posts.remove(post.id);

            Alert.alert("완료", "게시글이 삭제되었습니다.");

            // 🔥 삭제 후 이동
            router.back(); // 또는 router.push("/mypage")
          } catch (e) {
            Alert.alert("오류", "삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 90}
      >
        {/* 전체 스크롤 콘텐츠 */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        >
          {/* 제목 카드 */}
          <Card
            mode="elevated"
            style={{
              borderRadius: 10,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 1,
            }}
          >
            <Card.Content>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: colors.text,
                  marginBottom: 8,
                }}
              >
                {post.title}
              </Text>

              <View
                style={{ flexDirection: "row", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 13, color: colors.subText }}>
                  {post.author?.username ?? "익명"}
                </Text>
                <Text style={{ fontSize: 13, color: colors.subText }}>
                  {createdAt.toLocaleDateString("ko-KR")}{" "}
                  {createdAt.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {post.image_url && <DynamicImage uri={post.image_url} />}

          {/* 내용 카드 */}
          <Card
            mode="elevated"
            style={{
              borderRadius: 10,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingBottom: 0,
              marginBottom: 8,
              marginTop: 1,
            }}
          >
            <Card.Content>
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 22,
                  color: colors.text,
                }}
              >
                {post.content}
              </Text>
            </Card.Content>
          </Card>

          {isFromPush && (
            <Pressable
              onPress={onDeletePost}
              style={{
                alignSelf: "flex-end",
                marginBottom: 12,
                paddingVertical: 4,
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ color: "red", fontWeight: "600", fontSize: 14 }}>
                게시글 삭제
              </Text>
            </Pressable>
          )}

          {/* 댓글 제목 */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: colors.text,
              marginBottom: 10,
            }}
          >
            댓글
          </Text>

          {loadingComments ? (
            <Text style={{ color: colors.subText }}>댓글 불러오는 중...</Text>
          ) : comments.length === 0 ? (
            <Text style={{ color: colors.subText }}>아직 댓글이 없습니다.</Text>
          ) : (
            commentTree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                colors={colors}
                currentUsername={currentUsername ?? ""}
                editingComment={editingComment}
                editingText={editingText}
                setEditingText={setEditingText}
                startEdit={startEdit}
                cancelEdit={cancelEdit}
                submitEdit={submitEdit}
                deleteComment={deleteComment}
                setReplyTarget={setReplyTarget}
                handleFocus={handleFocus}
              />
            ))
          )}

        </ScrollView>


        {/* 댓글 입력 + "답글 작성 중" 표시: 화면 하단 고정 */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 10,
            borderTopWidth: 1,
            borderColor: colors.border,
            // 나머지 배경은 베이지
            backgroundColor: colors.background,
          }}
        >
          {/* ✅ 답글 모드일 때만 표시 */}
          {replyTarget && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: colors.subText,
                  marginRight: 8,
                }}
              >
                {replyTarget.username} 님께 답글 작성 중
              </Text>

              <Pressable onPress={() => setReplyTarget(null)}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.primary,
                    fontWeight: "500",
                  }}
                >
                  취소
                </Text>
              </Pressable>
            </View>
          )}

          {/* ✅ 실제 입력창 */}
          <View style={{ flexDirection: "row" }}>
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder={
                replyTarget ? "답글을 입력하세요" : "댓글을 입력하세요"
              }
              placeholderTextColor={colors.subText}
              onFocus={handleFocus}
              style={{
                flex: 1,
                color: colors.text,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderRadius: 8,
                borderColor: colors.border,
                // 댓글 인풋박스는 화이트
                backgroundColor: "#fff",
              }}
            />

            <Pressable
              onPress={handleSubmit}
              style={{
                marginLeft: 10,
                backgroundColor: colors.primary,
                paddingHorizontal: 14,
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>등록</Text>
            </Pressable>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );

}
function DynamicImage({ uri }: { uri: string }) {
  const [height, setHeight] = useState(200);
  const horizontalPadding = 16; // 
  const cardWidth = screenWidth - horizontalPadding * 2;

  useEffect(() => {
    Image.getSize(uri, (width, height) => {
      const scale = cardWidth / width; // 
      setHeight(height * scale);
    });
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={{
        width: cardWidth,
        height,
        resizeMode: "cover",
        borderRadius: 10,
        alignSelf: "center",

      }}
    />
  );
}

