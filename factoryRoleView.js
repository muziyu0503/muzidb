define(['backbone',
	'jquery',
	'text!app/roles/default/rolesViewTpl.html',
	'handlebars',
	'bootbox',
	'viewExpand',
	'animatescroll',
	'text!formTpl',
	'orgTree',
	'json',
	'application',
	'msgGrowl',
	'underscore',
	'select2',
	'datagrid',
	'bootstrap'], function (Backbone, $, rolesViewTpl, Handlebars, bootbox, viewExpand, animatescroll, formTpl, orgTreeController) {
	var Page = Backbone.View.extend({
		el: '#factoryPanel',  //把这段js渲染在某节点
		template: '',
		events: {
			"click #queryButton": "queryButton_click",
			"click #addButton": "addButton_click",
			"click #addModalButton": "addModalButton_click",
			"click #editModalButton": "editModalButton_click",
			"click #delButton": "delButton_click"
		},
		initialize: function () {
			this.$el.html(rolesViewTpl);
			_.extend(this, viewExpand);
			this.editDataModel = {};
			this.flag;
			//初始化表格
			this.initTable();
			this.render();
		},
		render: function () {
			var self = this;
			//初始化表格
			self.initTable();
			self.$el.find("#showTable").datagrid("renderData");
			this.$el.find("#setCompanyRole").remove();
			self.$el.find("#showTable").on("edit", function (event, data) {
				self.showEditModal(data);
			});
			self.tableHeight();
		},
		//设置showTable中ui-table-cntenthe和树的高度
		tableHeight: function () {
			var self = this;
			var documentHeight = $(window).height();
			var topHeight = $("#indexHeader").height();
			self.$el.find("#showTable .ui-table-content").height(documentHeight - topHeight - 360);
			window.reWin = function () {
				var docHgt = $(window).height();
				var topHgt = $("#indexHeader").height();
				var footHgt = $(".footer").outerHeight();
				var widHead = $(".widget .widget-header").outerHeight(true);
				var tabSearch = $(".ui-table .ui-table-search").outerHeight(true);
				var tabHead = $(".ui-table .ui-table-header").outerHeight();
				var tabFoot = $(".ui-table .ui-table-foot").outerHeight(true);
				self.$el.find("#showTable .ui-table-content").css("min-height", docHgt - topHgt - widHead - footHgt - tabSearch - tabHead - tabFoot - 20 - 30);
				self.$el.find("#showTable .ui-table-content").height(docHgt - topHgt - widHead - footHgt - tabSearch - tabHead - tabFoot - 20 - 30);
			};
			window.reWin();
		},
		/**查询**/
		queryButton_click: function () {
			var self = this;
			self.$el.find("#showTable").datagrid("renderData");
		},
		/**添加角色**/
		addButton_click: function () {
			var self = this;
			self.flag = true;
			self.$el.find("#addModelClick").val("1");
			var $form = self.$el.find("#addModal");
			self.restForm($form);
			$form.find(".btnBox").html("");
			$.fn.zTree.destroy('function');
			self.resourceDataModel = {};
			self.resourceDataModel.resource = [];
			var roleType = $form.parents(".tab-pane").attr("data-type");
			var roleTree = [];
			var ajaxData = {
				roleType: roleType,
				menuType: "厂家菜单"
			};
			$.ajax("roleManager/findMenuByUser.do", {
				type: "post",
				data: $.toJSON(ajaxData),
				contentType: "application/json; charset=utf-8",
				success: function (data) {
					var data = $.parseJSON(data);
					_.each(data, function (d) {
						roleTree.push(d);
					}, this);
					var setting = {
						data: {
							key: {
								id: "uniqueId"
							}
						},
						view: {
							selectedMulti: false
						},
						check: {
							enable: true
						},
						callback: {
							onCheck: self.mustCheck,
							onClick: self.treeClick
						}
					};
					self.tree = $.fn.zTree.init($form.find(".ztree"), setting, roleTree);
					self.btnShow();
					$form.modal();
				}
			});
		},
		/**添加保存事件**/
		addModalButton_click: function () {
			var self = this;
			var $form = self.$el.find("#addModal");
			var roleType = $form.parents(".tab-pane").attr("data-type");
			//验证表单
			if (this.validateFormAll($form)) {
				var checkNodes = this.tree.getCheckedNodes();
				if (checkNodes.length <= 0) {
					$.msgGrowl({
						type: 'warning', title: '添加角色', text: "请先分配菜单"
					});
					return;
				}
				self.resourceDataModel = {};
				self.resourceDataModel.resource = [];
				self.menuDataModal = {};
				self.menuDataModal.menuBtn = [];
				_.each(checkNodes, function (checkbox) {
					self.resourceDataModel.resource.push({
						menuId: checkbox.uniqueId,
						name: checkbox.name,
						buttonId: ""
					});
				}, this);
				this.resourceDataModel._resource = _.clone(this.resourceDataModel.resource);
				////获取数据的长度，写入循环
				for (var i = 0; i < this.resourceDataModel.resource.length; i++) {
					var menuId = this.resourceDataModel.resource[i].menuId;
					var menuTitleIds = $form.find(".btnChose" + menuId + " input[type=checkbox]:checked");
					//
					_.each(menuTitleIds, function (obj, index) {
						var buttonId = $(obj).attr("data-btn");
						var obj = _.clone(self.resourceDataModel.resource[i]);
						if (index == 0) {
							self.resourceDataModel._resource.push(obj);
							self.resourceDataModel._resource[i].buttonId = buttonId;
						} else {
							obj.buttonId = buttonId;
							self.resourceDataModel._resource.push(obj);
						}
					});
				}
				self.menuDataModal.menuBtn = self.resourceDataModel._resource;
				self.menuDataModal.roleName = this.getFormData($form).roleName;
				self.menuDataModal.roleType = roleType;
				console.log(self.menuDataModal);
				$.post("roleManager/addRole.do",
					$.toJSON(self.menuDataModal),
					function (data) {
						var data = $.parseJSON(data);
						if (data.result) {
							$form.modal("hide");
							$.msgGrowl({
								type: 'success', title: "添加角色", text: data.message
							});
							self.$el.find("#showTable").datagrid("reloadData");
							return;
						}
						$.msgGrowl({
							type: 'error', title: "添加角色", text: data.message
						});
					}
				);
			}
		},

		/**按钮显示**/
		btnShow: function () {
			var self = this;
			//this.flag==true为 添加
			var roleId;
			var url = "";
			var $form;
			var ajaxData = {};
			if (!self.flag) {
				roleId = self.$el.find("#editRole").val();
				$form = self.$el.find("#editModal");
				ajaxData = {
					"roleId": roleId,
					"menuType": "厂家菜单"
				};
				url = "roleManager/findButtonByMenuIdForUpdate.do";
			} else {
				$form = self.$el.find("#addModal");
				ajaxData = {
					"menuType": "厂家菜单"
				};
				url = "roleManager/findButtonByMenuIdForAdd.do";
			}
			$.ajax(url, {
				type: "post",
				contentType: "application/json; charset=utf-8",
				data: $.toJSON(ajaxData),
				dataType: "json",
				success: function (data) {
					var btnTpl =
						"{{#each this}}"
						+ "<div class='menuTitle menuTitle{{menuId}}' data-id='{{menuId}}' style='color:#ec971f;border-bottom: 1px solid #ccc;'>"
						+ "{{menuName}}"
						+ "</div>"
						+ "<div class='btnChose btnChose"
						+ "{{menuId}}"
						+ "' style='margin-bottom: 5px;padding-bottom:5px;'>"
						+ "{{#each btns}}"
						+ "<lable style='margin-right:5px;display: inline-block;width: 85px;white-space: nowrap;overflow-x: hidden;' title='{{btnName}}'>"
						+ "{{btnName}}"
						+ "<input type='checkbox' style='vertical-align: -2px;margin-left: 2px;' data-btn='{{btnId}}' {{#if checked}}checked{{/if}}>"
						+ "</lable>"
						+ '{{/each}}'
						+ "</div>"
						+ '{{/each}}';
					var Template = Handlebars.compile(btnTpl);
					/**清空按钮容器中所有元素，并重新赋予点击的输入框中的按钮容器按钮**/
					$(".btnBox").html("");
					$form.find(".btnBox").html(Template(data));
					//暴力隐藏逐个显示
					$(".menuTitle").hide();
					$(".btnChose").hide();
					var checkNodes = self.tree.getCheckedNodes();
					_.each(checkNodes, function (checkbox, index) {
						var menuId = checkbox.uniqueId;
						$(".menuTitle" + menuId).show();
						$(".btnChose" + menuId).show();
					}, this);
				}
			});
		},
		/**如果不勾选菜单无法配置按钮**/
		mustCheck: function (event, treeId, treeNode) {
			var self = this;
			var chk = treeNode.checked;
			var treeId = treeNode.uniqueId;
			var children = treeNode.children;
			//为了响应测试对不勾选按钮，按钮消失的要求
			//先粗暴的将所有的按钮隐藏，在每次check的时候。这里可能是一个bug
			//再把已经checked的按钮显示，此处需要一个循环
			if (children.length == 0) {
				if (chk) {
					$(".menuTitle" + treeId).show();
					$(".btnChose" + treeId).show();
					$(".btnChose" + treeId + " input").prop("checked", true);
					return;
				}
				$(".menuTitle" + treeId).hide();
				$(".btnChose" + treeId).hide();
				return;
			}
			if (chk) {
				_.each(children, function (checkbox, index) {
					var menuId = checkbox.uniqueId;
					//3级菜单需要找到children的children
					if ($(checkbox)[0].children.length > 0) {
						var lastChild = $(checkbox)[0].children;
						for (var i = 0; i < lastChild.length; i++) {
							menuId = lastChild[i].uniqueId;
							$(".menuTitle" + menuId).show();
							$(".btnChose" + menuId).show();
							$(".btnChose" + menuId + " input").prop("checked", true);
						}
						return;
					}
					$(".menuTitle" + menuId).show();
					$(".btnChose" + menuId).show();
					$(".btnChose" + menuId + " input").prop("checked", true);
				}, this);
				var treeIdLastOne;
				if (children[0].children.length > 0) {
					treeIdLastOne = children[0].children[0].uniqueId;
				} else {
					treeIdLastOne = children[0].uniqueId;
				}
				$(".menuTitle" + treeIdLastOne).animatescroll({element: '.btnBox'});
				return;
			}
			_.each(children, function (checkbox) {
				var menuId = checkbox.uniqueId;
				if ($(checkbox)[0].children.length > 0) {
					var lastChild = $(checkbox)[0].children;
					for (var i = 0; i < lastChild.length; i++) {
						menuId = lastChild[i].uniqueId;
						$(".menuTitle" + menuId).hide();
						$(".btnChose" + menuId).hide();
					}
					return;
				}
				$(".menuTitle" + menuId).hide();
				$(".btnChose" + menuId).hide();
			}, this);
		},
		/**点击滑动到该菜单出**/
		treeClick: function (event, treeId, treeNode) {
			var treeId = treeNode.uniqueId;
			var children = treeNode.children;
			if (children.length == 0) {
				$(".menuTitle" + treeId).animatescroll({element: '.btnBox'});
				return;
			}
			var treeIdLastOne;
			if (children[0].children.length > 0) {
				treeIdLastOne = children[0].children[0].uniqueId;
			} else {
				treeIdLastOne = children[0].uniqueId;
			}
			$(".menuTitle" + treeIdLastOne).animatescroll({element: '.btnBox'});
		},
		/**修改角色**/
		showEditModal: function (data) {
			var self = this;
			self.flag = false;
			self.$el.find("#addModelClick").val("");
			var $form = this.$el.find("#editModal");
			var roleType = $form.parents(".tab-pane").attr("data-type");
			this.fillFormData($form, data);
			this.editDataModel.roleId = data.roleId;
			this.$el.find("#editRole").val(data.roleId);
			this.clearValidateState($form);
			$form.find(".btnBox").html("");
			$.fn.zTree.destroy('function');
			self.resourceDataModel = {};
			self.resourceDataModel.resource = [];
			var roleTree2 = [];
			var ajaxData = {
				"roleId": data.roleId,
				menuType: "厂家菜单"
			};
			$.post("roleManager/findMenuByRoleId.do",
				$.toJSON(ajaxData),
				function (data) {
					var data = $.parseJSON(data);
					_.each(data, function (d) {
						roleTree2.push(d);
					}, this);
					var setting = {
						data: {
							key: {
								id: "uniqueId"
							}
						},
						view: {
							selectedMulti: false
						},
						check: {
							enable: true
						},
						callback: {

							onCheck: self.mustCheck,
							onClick: self.treeClick
						}
					};
					self.tree = $.fn.zTree.init($form.find(".ztree"), setting, roleTree2);
					self.btnShow();
					$form.modal();
				}
			);
		},
		/**修改保存**/
		editModalButton_click: function () {
			var self = this;
			var $form = self.$el.find("#editModal");
			//验证表单
			if (this.validateFormAll($form)) {
				var checkNodes = this.tree.getCheckedNodes();
				if (checkNodes.length <= 0) {
					$.msgGrowl({
						type: 'warning', title: '修改角色', text: "请先分配菜单"
					});
					return;
				}
				self.resourceDataModel = {};
				self.resourceDataModel.resource = [];
				self.menuDataModal = {};
				self.menuDataModal.menuBtn = [];
				_.each(checkNodes, function (checkbox) {
					self.resourceDataModel.resource.push({
						menuId: checkbox.uniqueId,
						name: checkbox.name,
						buttonId: ""
					});
				}, this);
				this.resourceDataModel._resource = _.clone(this.resourceDataModel.resource);
				//获取数据的长度，写入循环
				for (var i = 0; i < this.resourceDataModel.resource.length; i++) {
					var menuId = this.resourceDataModel.resource[i].menuId;
					var menuTitleIds = $form.find(".btnChose" + menuId + " input[type=checkbox]:checked");
					//
					_.each(menuTitleIds, function (obj, index) {
						var buttonId = $(obj).attr("data-btn");
						var obj = _.clone(self.resourceDataModel.resource[i]);
						if (index == 0) {
							self.resourceDataModel._resource.push(obj);
							self.resourceDataModel._resource[i].buttonId = buttonId;
						} else {
							obj.buttonId = buttonId;
							self.resourceDataModel._resource.push(obj);
						}
					});
				}
				self.menuDataModal.menuBtn = self.resourceDataModel._resource;
				_.extend(this.editDataModel, this.getFormData($form));
				_.extend(self.menuDataModal, this.editDataModel);
				$.post("roleManager/updateRole.do",
					$.toJSON(self.menuDataModal),
					function (data) {
						var data = $.parseJSON(data);
						if (data.result) {
							$form.modal("hide");
							$.msgGrowl({
								type: 'success', title: "修改角色", text: data.message
							});
							self.$el.find("#showTable").datagrid("renderData");
							return;
						}
						$.msgGrowl({
							type: 'error', title: "修改角色", text: data.message
						});
					}
				);
			}
		},
		/**删除角色**/
		delButton_click: function () {
			var self = this;
			var selectRow = self.$el.find("#showTable").datagrid("getSelectedRow");
			if (selectRow.length == 0) {
				$.msgGrowl({
					type: 'warning', title: '删除角色', text: '至少选择一条数据'
				});
				return;
			}

			var id = [];
			_.each(selectRow, function (row) {
				id.push(row.roleId);
			});
			var ajaxData = {
				roleIds: id
			};
			bootbox.confirm("删除该角色将会同时解除与该角色绑定的用户关系，确定要删除?", function (result) {
				if (result) {
					$.ajax({
						type: "post",
						url: 'roleManager/deleteRoles.do',
						async: false,
						data: $.toJSON(ajaxData),
						dataType: "json",
						success: function (data) {
							if (data.result) {
								$.msgGrowl({
									type: 'success', title: "删除角色", text: data.message
								});
								self.$el.find("#showTable").datagrid("renderData");
								return;
							}
							$.msgGrowl({
								type: 'error', title: "删除角色", text: data.message
							});
						}
					})
				}
			});
		},
		/**
		 * 初始化表格
		 **/
		initTable: function () {
			var self = this;
			var roleType = self.$el.attr("data-type");
			self.$el.find("#showTable").datagrid({
				columns: [
					{
						type: "checkbox"
					},
					{
						property: 'roleName',
						sortProperty: "name",
						label: '角色名称',
						type: 'data',
						sortable: true,
						isShow: true,
						widthClass: 'ui-column-xlarge'
					},
					{
						label: "修改",
						type: "command",
						commandName: "edit"
					}
				],
				localKey: "datagrid_factoryRoleView",
				dataSource: function () {
					var dataSource = {
						data: function (options, callback) {
							var ajaxData = {
								"roleType": roleType,
								"roleName": self.$el.find("#roleName").val(),
								"pageIndex": options.pageIndex,
								"pageSize": options.pageSize,
								"sortName": options.sortName,
								"sortType": options.sortType
							};
							self.model.initGrid(ajaxData, function (data) {
								callback(data);
							});
						}
					};
					return dataSource;
				}
			});
		}
	});
	return Page;
});