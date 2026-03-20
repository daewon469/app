import React from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";


export type CommentNode = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;

  parent_id?: number | null;
  is_deleted?: boolean;

  children?: CommentNode[];
};


type Props = {
  node: CommentNode;
  depth?: number;
  colors: any;
  currentUsername: string;


  editingComment: CommentNode | null;
  editingText: string;
  setEditingText: (v: string) => void;
  startEdit: (node: CommentNode) => void;
  cancelEdit: () => void;
  submitEdit: () => void;

  deleteComment: (node: CommentNode) => void;
  setReplyTarget: (node: CommentNode | null) => void;
  handleFocus: () => void;
};

export default function CommentItem({
  node,
  depth = 0,
  colors,
  currentUsername,

  editingComment,
  editingText,
  setEditingText,
  startEdit,
  cancelEdit,
  submitEdit,

  deleteComment,
  setReplyTarget,
  handleFocus,
}: Props) {
  const isMine = node.username === currentUsername;
  const isDeleted = node.is_deleted;
  const isEditing = editingComment?.id === node.id;
  const createdAt = new Date(node.created_at);

  return (
    <View key={node.id}>
      <View
        style={{
          marginBottom: 4,
          padding: 8,
          borderRadius: 8,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          marginLeft: depth * 16, // 깊이 들여쓰기
        }}
      >
        {/* 사용자 + 날짜 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              fontSize: 13,
              color: colors.text,
            }}
          >
            {node.username}
          </Text>

          <Text
            style={{
              fontSize: 11,
              color: colors.subText,
            }}
          >
            {createdAt.toLocaleDateString("ko-KR")}{" "}
            {createdAt.toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

       {/* 내용 or 수정 */}
        {isEditing ? (
          <>
            <TextInput
              value={editingText}
              onChangeText={setEditingText}
              multiline
              style={{
                marginTop: 6,
                padding: 8,
                borderWidth: 1,
                borderRadius: 8,
                borderColor: colors.border,
                color: colors.text,
                minHeight: 40,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 8,
              }}
            >
              <Pressable
                onPress={cancelEdit}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.subText,
                  }}
                >
                  취소
                </Text>
              </Pressable>
              <Pressable
                onPress={submitEdit}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: "#fff",
                    fontWeight: "600",
                  }}
                >
                  저장
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text
            style={{
              fontSize: 14,
              color: isDeleted ? colors.subText : colors.text,
              fontStyle: isDeleted ? "italic" : "normal",
              marginTop: 4,
            }}
          >
            {isDeleted ? "삭제된 댓글입니다." : node.content}
          </Text>
        )}

      {/* 하단 버튼: 답글 / 수정·삭제 */}
        {!isEditing && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            {/* 좌측: 답글 버튼 */}
            <Pressable
              disabled={isDeleted}
              onPress={() => {
                setReplyTarget(node);
                handleFocus();
              }}
              style={{
                paddingStart: 3,
                opacity: isDeleted ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: isDeleted ? colors.subText : colors.primary,
                  fontWeight: "500",
                }}
              >
                답글
              </Text>
            </Pressable>

            {/* 우측: 수정 / 삭제 버튼들 */}
            {isMine && !isDeleted && (
              <View style={{ flexDirection: "row", marginBottom:-6 }}>
                <Pressable
                  onPress={() => startEdit(node)}
                  style={{
                    paddingEnd: 12,
                    marginRight: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.subText,
                    }}
                  >
                    수정
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => deleteComment(node)}
                  style={{
                  
                    paddingEnd: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#cc4444",
                    }}
                  >
                    삭제
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 재귀: children 렌더 */}
      {node.children &&
        node.children.map((child) => (
          <CommentItem
            key={child.id}
            node={child}
            depth={depth + 1}
            colors={colors}
            currentUsername={currentUsername}
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
        ))}
    </View>
  );
}
